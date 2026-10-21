import { handbookGroups, validateHandbook } from "../domain/handbook-schema";
import type { Handbook } from "../domain/handbook-schema";
import { planInputSchema, planSchema } from "../domain/plan-schema";
import type { GeneratedPlan, PlanInput } from "../domain/types";
import { assertGuideQuality } from "../domain/plan-quality";
import { AIRequestError } from "./ai-errors";
export interface PlanContext {
  userId: string;
  tripId: string;
  target: string;
  newTrip: boolean;
}
export interface PlanProgress {
  phase?: "days" | "handbook";
  guideCompleted?: number;
  guideTotal?: number;
  completed: number;
  total: number;
  currentDay: number;
  persisted: boolean;
}
export interface PlanDraft {
  v: 1;
  signature: string;
  input: PlanInput;
  context?: PlanContext;
  parts: GeneratedPlan[];
  handbookParts?: Handbook[];
  updatedAt: number;
}
export interface PlanJobOptions {
  onRouteReady?: (plan: GeneratedPlan) => void;
  requestHandbook?: (
    input: PlanInput,
    group: number,
    plan: GeneratedPlan,
  ) => Promise<Handbook>;
  context?: PlanContext;
  identity?: string;
  onProgress?: (progress: PlanProgress) => void;
  signal?: AbortSignal;
  resume?: boolean;
}
const DRAFT_KEY = "moodnomad-ai-plan-draft-v1";
let memory: PlanDraft | null = null;
const readCache = new Map<string, { raw: string; value: PlanDraft | null }>();
let epoch = 0;
function valid(value: unknown): value is PlanDraft {
  try {
    const d = value as PlanDraft;
    if (
      d.v !== 1 ||
      typeof d.signature !== "string" ||
      !Array.isArray(d.parts) ||
      !Number.isFinite(d.updatedAt) ||
      Date.now() - d.updatedAt > 7 * 86400000
    )
      return false;
    const input = planInputSchema.parse(d.input);
    if (
      d.parts.length > input.days ||
      (d.handbookParts?.length || 0) > handbookGroups.length
    )
      return false;
    d.handbookParts?.forEach((part, i) => validateHandbook(part, i));
    for (const [index, part] of d.parts.entries()) {
      planSchema.parse(part);
      const budget =
        Math.floor(input.budgetMinor / input.days) +
        (index < input.budgetMinor % input.days ? 1 : 0);
      assertGuideQuality(part, { ...input, days: 1, budgetMinor: budget });
    }
    if (
      d.context &&
      (typeof d.context.userId !== "string" ||
        typeof d.context.tripId !== "string" ||
        typeof d.context.target !== "string" ||
        typeof d.context.newTrip !== "boolean")
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
export function loadPlanDraft(): PlanDraft | null {
  const values: PlanDraft[] = [];
  for (const kind of ["localStorage", "sessionStorage"] as const) {
    try {
      const raw = globalThis[kind]?.getItem(DRAFT_KEY);
      if (raw) {
        let entry = readCache.get(kind);
        if (!entry || entry.raw !== raw) {
          const value = raw.length <= 4500000 ? JSON.parse(raw) : null;
          entry = { raw, value: valid(value) ? value : null };
          readCache.set(kind, entry);
        }
        if (entry.value && Date.now() - entry.value.updatedAt <= 7 * 86400000)
          values.push(entry.value);
      }
    } catch {}
  }
  if (memory && Date.now() - memory.updatedAt <= 7 * 86400000)
    values.push(memory);
  return values.sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
}
function store(draft: PlanDraft) {
  memory = structuredClone(draft);
  for (const kind of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = globalThis[kind];
      if (!storage) continue;
      storage.setItem(DRAFT_KEY, JSON.stringify(draft));
      return true;
    } catch {}
  }
  return false;
}
export function clearPlanDraft() {
  epoch++;
  memory = null;
  readCache.clear();
  for (const kind of ["localStorage", "sessionStorage"] as const)
    try {
      globalThis[kind]?.removeItem(DRAFT_KEY);
    } catch {}
}
/** Smaller context for route continuity; never truncates JSON or changes amounts. */
export function planContextText(plan: GeneratedPlan) {
  const full = JSON.stringify(plan);
  if (full.length <= 120000) return full;
  const compact = {
    ...plan,
    summary: "已生成路线摘要，用于保持日期、地点与费用衔接。",
    days: plan.days.map((d) => ({
      ...d,
      items: d.items.map(({ details, ...item }) => ({ ...item, note: "" })),
    })),
  };
  return JSON.stringify(compact);
}
function merge(input: PlanInput, parts: GeneratedPlan[]): GeneratedPlan {
  if (input.days === 1) return parts[0];
  return planSchema.parse({
    title: `${input.destination} · ${input.days} 天旅行攻略`,
    summary: `已按你的偏好逐日生成 ${input.days} 天攻略，覆盖三餐、游玩、茶歇和夜间安排。路线、预约及费用请在出发前核验。`,
    assumptions: [...new Set(parts.flatMap((p) => p.assumptions))].slice(0, 10),
    days: parts.flatMap((p) => p.days),
  });
}
/** Recover completed route without issuing model calls or requiring a completed handbook. */
export function routeFromDraft(draft: PlanDraft): GeneratedPlan {
  if (!valid(draft) || draft.parts.length !== draft.input.days)
    throw new Error("路线尚未完整生成，请继续未完成日期。");
  return merge(draft.input, draft.parts);
}

function contextFor(input: PlanInput, parts: GeneratedPlan[]) {
  if (input.previousPlan) {
    const prior = planSchema.parse(JSON.parse(input.previousPlan));
    if (!parts.length) return planContextText(prior);
    const days = [...prior.days];
    parts.forEach((p, i) => {
      if ((input.dayOffset || 0) + i < days.length)
        days[(input.dayOffset || 0) + i] = p.days[0];
    });
    return planContextText({ ...prior, days });
  }
  return parts.length
    ? planContextText({ ...parts[0], days: parts.flatMap((p) => p.days) })
    : undefined;
}
/** One paid request per day, sequential checkpoints; explicit retry resumes the first incomplete day. */
async function performDailyPlan(
  raw: PlanInput,
  request: (input: PlanInput) => Promise<GeneratedPlan>,
  options: PlanJobOptions = {},
  requestedAt = Date.now(),
): Promise<GeneratedPlan> {
  const input = planInputSchema.parse(raw);
  if (options.signal?.aborted)
    throw new AIRequestError("生成已停止，保留的草稿未改变。", "output");
  const currentEpoch = epoch;
  if (input.budgetMinor < input.days)
    throw new AIRequestError(
      "总预算过低，无法分配到每一天，请先调整预算。",
      "output",
    );
  const withHandbook =
    input.detailedGuide &&
    (!options.context || options.context.target === "all");
  const signature = JSON.stringify({
    input,
    identity: options.identity || "",
    context: options.context,
  });
  const old = loadPlanDraft();
  const draft: PlanDraft =
    old?.signature === signature &&
    (old.parts.length < input.days ||
      (withHandbook &&
        (old.handbookParts?.length || 0) < handbookGroups.length) ||
      options.resume ||
      old.updatedAt >= requestedAt)
      ? structuredClone(old)
      : {
          v: 1,
          signature,
          input,
          context: options.context,
          parts: [],
          updatedAt: Date.now(),
        };
  let persisted = store(draft);
  const progress = () =>
    options.onProgress?.({
      completed: draft.parts.length,
      total: input.days,
      currentDay:
        (input.dayOffset || 0) + Math.min(input.days, draft.parts.length + 1),
      persisted,
    });
  progress();
  for (let i = draft.parts.length; i < input.days; i++) {
    if (options.signal?.aborted)
      throw new AIRequestError(
        `生成已停止，已保留 ${draft.parts.length}/${input.days} 天；可继续未完成部分。`,
        "output",
      );
    const offset = (input.dayOffset || 0) + i;
    const budget =
      Math.floor(input.budgetMinor / input.days) +
      (i < input.budgetMinor % input.days ? 1 : 0);
    const minimum =
      input.budgetMinMinor === undefined
        ? undefined
        : Math.floor(input.budgetMinMinor / input.days) +
          (i < input.budgetMinMinor % input.days ? 1 : 0);
    const daily: PlanInput = {
      ...input,
      days: 1,
      totalDays: input.totalDays ?? (input.dayOffset || 0) + input.days,
      dayOffset: offset,
      budgetMinor: budget,
      budgetMinMinor: minimum,
      previousPlan: contextFor(input, draft.parts),
    };
    try {
      const part = planSchema.parse(await request(daily));
      if (epoch !== currentEpoch)
        throw new AIRequestError(
          "生成草稿已清除，本次结果不会恢复。",
          "output",
        );
      assertGuideQuality(part, daily);
      draft.parts.push(part);
      draft.updatedAt = Math.max(Date.now(), draft.updatedAt + 1);
      persisted = store(draft);
      progress();
    } catch (e) {
      if (epoch !== currentEpoch) throw e;
      const kind = e instanceof AIRequestError ? e.kind : "output";
      throw new AIRequestError(
        `第 ${offset + 1} 天未完成（已保留 ${draft.parts.length}/${input.days} 天）。${(e as Error).message} 点击继续只生成未完成的天数。`,
        kind,
      );
    }
  }
  if (options.signal?.aborted)
    throw new AIRequestError(
      `生成已停止，已保留 ${draft.parts.length}/${input.days} 天；可恢复查看。`,
      "output",
    );
  const result = merge(input, draft.parts);
  if (input.detailedGuide) {
    const missing = (
      [
        ["departure", "出发地"],
        ["arrivalDeparture", "抵达返程时间"],
        ["companions", "同行年龄体力"],
        ["accommodation", "住宿房型早餐"],
        ["transport", "交通偏好"],
        ["diet", "饮食禁忌"],
        ["budgetIncludes", "预算覆盖范围"],
      ] as const
    )
      .filter(([key]) => !input.travelProfile?.[key])
      .map(([, label]) => label);
    if (missing.length)
      result.assumptions = [
        `待确认：${missing.join("、")}；相关安排仅按通用条件估算，不代表已确认适配。`,
        ...result.assumptions,
      ].slice(0, 10);
  }
  assertGuideQuality(result, input);
  if (withHandbook) {
    options.onRouteReady?.(structuredClone(result));
    draft.handbookParts ||= [];
    for (
      let group = draft.handbookParts.length;
      group < handbookGroups.length;
      group++
    ) {
      if (options.signal?.aborted)
        throw new AIRequestError(
          "生成已停止，路线与已完成手册均已保留，可继续。",
          "output",
        );
      options.onProgress?.({
        phase: "handbook",
        completed: input.days,
        total: input.days,
        currentDay: input.days,
        guideCompleted: group,
        guideTotal: handbookGroups.length,
        persisted,
      });
      try {
        if (!options.requestHandbook)
          throw new Error("当前服务不支持完整旅行手册，请更新服务后重试。");
        const part = validateHandbook(
          await options.requestHandbook(input, group, result),
          group,
        );
        if (epoch !== currentEpoch) throw new Error("生成草稿已清除。");
        draft.handbookParts.push(part);
        draft.updatedAt = Math.max(Date.now(), draft.updatedAt + 1);
        persisted = store(draft);
      } catch (e) {
        throw new AIRequestError(
          `路线已完成；旅行手册第 ${group + 1} 组未完成（已保留 ${draft.handbookParts.length}/4 组）。${(e as Error).message} 继续时不会重生成路线或已完成章节。`,
          e instanceof AIRequestError ? e.kind : "output",
        );
      }
    }
    result.handbook = validateHandbook({
      sections: draft.handbookParts.flatMap((p) => p.sections),
      budget: draft.handbookParts.flatMap((p) => p.budget),
    });
  }
  return result;
}

let queue: Promise<unknown> = Promise.resolve();
export async function generateDailyPlan(
  input: PlanInput,
  request: (input: PlanInput) => Promise<GeneratedPlan>,
  options: PlanJobOptions = {},
): Promise<GeneratedPlan> {
  const requestedAt = Date.now();
  const run = () => performDailyPlan(input, request, options, requestedAt);
  const locks = globalThis.navigator?.locks;
  if (locks) return locks.request("moodnomad-ai-plan-generation", run);
  const pending = queue.then(run, run);
  queue = pending.then(
    () => undefined,
    () => undefined,
  );
  return pending;
}
