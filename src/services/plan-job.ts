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
  updatedAt: number;
}
export interface PlanJobOptions {
  context?: PlanContext;
  identity?: string;
  onProgress?: (progress: PlanProgress) => void;
  signal?: AbortSignal;
  resume?: boolean;
}
const DRAFT_KEY = "moodnomad-ai-plan-draft-v1";
let memory: PlanDraft | null = null;
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
    if (d.parts.length > input.days) return false;
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
        const value = JSON.parse(raw);
        if (valid(value)) values.push(value);
      }
    } catch {}
  }
  if (memory && valid(memory)) values.push(memory);
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
  const signature = JSON.stringify({
    input,
    identity: options.identity || "",
    context: options.context,
  });
  const old = loadPlanDraft();
  const draft: PlanDraft =
    old?.signature === signature &&
    (old.parts.length < input.days ||
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
  assertGuideQuality(result, input);
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
