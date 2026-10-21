import TravelHandbook from "../components/TravelHandbook";
import { travelProfileSchema } from "../domain/handbook-schema";
import {
  clearPlanDraft,
  loadPlanDraft,
  planContextText,
} from "../services/plan-job";
import type { PlanContext, PlanProgress } from "../services/plan-job";
import { AIRequestError } from "../services/ai-errors";
import type { AIErrorKind } from "../services/ai-errors";
import { getAISettings, proxyURL } from "../services/ai-settings";
import { applyPlan, newPlannedTrip } from "../domain/journey";
import { mockPlan } from "../services/planner";
import Recommendation, {
  Coverage,
  slotLabels,
} from "../components/Recommendation";
import { referenceChoices } from "../data/guides";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  Info,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useMood } from "../context";
import { Button, Field, PageHeading } from "../components/UI";
import { generatePlan } from "../services/planner";
import type { GeneratedPlan, PlanInput } from "../domain/types";
import { uid } from "../domain/types";
import { money, parseMoney } from "../domain/money";
export default function Planner() {
  const {
    trip,
    state,
    createTrip,
    planningDestination,
    updateTrip,
    setView,
    notify,
    canEdit,
    cloud,
  } = useMood();
  const [availableDraft, setAvailableDraft] = useState(loadPlanDraft);
  const draftNeedsHandbook =
    availableDraft?.input.detailedGuide &&
    availableDraft.context?.target === "all";
  const [progress, setProgress] = useState<PlanProgress | null>(null);
  const [stopping, setStopping] = useState(false);
  const control = useRef<AbortController | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      control.current?.abort();
    };
  }, []);
  const [detailedGuide, setDetailedGuide] = useState(true);
  const [offline, setOffline] = useState(false);
  const [adjust, setAdjust] = useState("");
  const [newTrip, setNewTrip] = useState(!!planningDestination || !trip.id);
  const [draft, setDraft] = useState<PlanInput | null>(null);
  const [interests, setInterests] = useState<string[]>(trip.interests);
  const [pace, setPace] = useState<PlanInput["pace"]>(trip.pace);
  const [result, setResult] = useState<GeneratedPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failureKind, setFailureKind] = useState<AIErrorKind | null>(null);
  const healthURL = () => {
    try {
      const url = new URL(proxyURL(getAISettings().proxyUrl));
      url.pathname = url.pathname.replace(/\/api\/ai\/?$/, "/api/health");
      return url.href;
    } catch {
      return undefined;
    }
  };
  const [target, setTarget] = useState("all");
  const [input, setInput] = useState<PlanInput | null>(null);
  const [applied, setApplied] = useState(false);
  const [references, setReferences] = useState(trip.guideReferences || "");
  const [preferences, setPreferences] = useState<
    NonNullable<PlanInput["referencePreferences"]>
  >(trip.referencePreferences || ["dianping", "must-eat", "local"]);
  const run = async (
    data: PlanInput,
    useOffline = false,
    restore?: PlanContext,
    resume = false,
  ) => {
    if (running.current) return;
    running.current = true;
    const activeTarget = restore?.target ?? target;
    const activeNewTrip = restore?.newTrip ?? newTrip;
    if (restore) {
      setTarget(activeTarget);
      setNewTrip(activeNewTrip);
    }
    control.current = new AbortController();
    setStopping(false);
    setProgress(null);
    setResult(null);
    setBusy(true);
    setError("");
    setFailureKind(null);
    setApplied(false);
    try {
      setOffline(useOffline);
      setDraft(data);
      const request: PlanInput = resume
        ? data
        : {
            ...data,
            days: activeTarget === "all" ? data.days : 1,
            totalDays: data.totalDays ?? data.days,
            budgetMinor:
              activeTarget === "all"
                ? data.budgetMinor
                : Math.floor(data.budgetMinor / Math.max(1, data.days)),
            budgetMinMinor:
              activeTarget === "all"
                ? data.budgetMinMinor
                : Math.floor(
                    (data.budgetMinMinor || 0) / Math.max(1, data.days),
                  ),
            dayOffset: activeTarget === "all" ? 0 : Number(activeTarget),
          };
      const context: PlanContext = restore || {
        userId: state.userId,
        tripId: trip.id,
        target: activeTarget,
        newTrip: activeNewTrip,
      };
      const plan = useOffline
        ? mockPlan(request)
        : await generatePlan(request, {
            context,
            resume,
            signal: control.current.signal,
            onProgress: (p) => {
              if (mounted.current) setProgress(p);
            },
          });
      if (!mounted.current) return;
      setAvailableDraft(loadPlanDraft());
      setResult(plan);
      setInput(data);
    } catch (e) {
      if (!mounted.current) return;
      setAvailableDraft(loadPlanDraft());
      setFailureKind(e instanceof AIRequestError ? e.kind : null);
      setError((e as Error).message);
    } finally {
      running.current = false;
      control.current = null;
      if (mounted.current) {
        setBusy(false);
        setStopping(false);
      }
    }
  };
  return (
    <div className="fade-in">
      <PageHeading
        eyebrow="A LITTLE HELP, A LOT OF POSSIBILITIES"
        title="把向往，变成一份好攻略"
        description="说说你的旅行偏好，让灵感替你多走一步。"
      />
      {availableDraft &&
        availableDraft.parts.length > 0 &&
        availableDraft.context?.userId === state.userId &&
        availableDraft.context?.tripId === trip.id &&
        !busy &&
        !result && (
          <section className="panel p-5 mb-5">
            <h3>
              {availableDraft.input.destination} · 已保留{" "}
              {availableDraft.parts.length}/{availableDraft.input.days} 天攻略
            </h3>
            <p className="my-3">
              {availableDraft.parts.length === availableDraft.input.days
                ? draftNeedsHandbook &&
                  (availableDraft.handbookParts?.length || 0) < 4
                  ? `每日路线已完成，手册已保留 ${availableDraft.handbookParts?.length || 0}/4 组，可继续补全。`
                  : "完整攻略已生成，可直接恢复查看，不再请求模型。"
                : "可以继续未完成的天数，已完成部分不会重复调用模型。"}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() =>
                  void run(
                    availableDraft.input,
                    false,
                    availableDraft.context,
                    true,
                  )
                }
              >
                {availableDraft.parts.length === availableDraft.input.days &&
                (!draftNeedsHandbook ||
                  availableDraft.handbookParts?.length === 4)
                  ? "恢复已生成攻略"
                  : availableDraft.parts.length === availableDraft.input.days &&
                      draftNeedsHandbook
                    ? "继续补全旅行手册"
                    : "继续未完成天数"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  clearPlanDraft();
                  setAvailableDraft(null);
                }}
              >
                丢弃生成草稿
              </Button>
            </div>
          </section>
        )}
      <div className="planner-layout">
        <section className="panel planner-form">
          <div className="panel-heading">
            <span className="stat-icon purple">
              <Sparkles size={21} />
            </span>
            <div>
              <h2>你的旅行，你来定义</h2>
              <p>少一点纠结，多一点期待。</p>
            </div>
          </div>
          <form
            key={trip.id}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                const personal = Object.fromEntries(
                  [
                    "departure",
                    "season",
                    "arrivalDeparture",
                    "companions",
                    "accommodation",
                    "transport",
                    "diet",
                    "mustDo",
                    "avoid",
                    "other",
                    "budgetIncludes",
                  ].map((key) => [key, String(f.get(key) || "").trim()]),
                );
                const data: PlanInput = {
                  detailedGuide,
                  travelProfile: travelProfileSchema.parse({
                    ...personal,
                    nights: Number(f.get("nights")),
                  }),
                  destination: String(f.get("destination")).trim(),
                  days: Number(f.get("days")),
                  travelers: Number(f.get("travelers")),
                  startDate: String(f.get("date")),
                  budgetMinMinor: parseMoney(String(f.get("minBudget"))),
                  budgetMinor: parseMoney(String(f.get("budget"))),
                  pace,
                  interests,
                  referencePreferences: preferences,
                  references,
                };
                if (data.budgetMinMinor! > data.budgetMinor)
                  throw new Error("预算下限不能超过上限");
                void run(
                  data,
                  (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                    "value",
                  ) === "offline",
                );
              } catch (err) {
                setFailureKind(null);
                setError((err as Error).message);
              }
            }}
          >
            <Field
              label="想去哪里"
              hint="真实 AI 支持目的地定制；离线参考仅部分城市有详细路线。"
            >
              <div className="input-icon">
                <MapPin size={17} />
                <input
                  name="destination"
                  defaultValue={planningDestination || trip.destination}
                  placeholder="目的地城市"
                  required
                  maxLength={40}
                />
              </div>
            </Field>
            <div className="form-row">
              <Field label="几天的旅行">
                <select
                  name="days"
                  defaultValue={trip.days.length || 5}
                  disabled={target !== "all"}
                  onChange={(e) => {
                    const nights =
                      e.currentTarget.form?.elements.namedItem("nights");
                    if (nights instanceof HTMLInputElement)
                      nights.value = String(
                        Math.max(0, Number(e.target.value) - 1),
                      );
                  }}
                >
                  {Array.from({ length: 14 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1} 天
                    </option>
                  ))}
                </select>
                {target !== "all" && (
                  <input type="hidden" name="days" value={trip.days.length} />
                )}
              </Field>
              <Field label="总预算（元）">
                <input
                  name="budget"
                  defaultValue={String(trip.budgetMinor / 100)}
                  inputMode="decimal"
                  required
                />
              </Field>
            </div>
            <div className="form-row">
              <Field label="出发日期">
                <input
                  name="date"
                  type="date"
                  defaultValue={
                    trip.startDate || new Date().toISOString().slice(0, 10)
                  }
                  required
                />
              </Field>
              <Field label="同行人数">
                <input
                  name="travelers"
                  type="number"
                  min="1"
                  max="20"
                  defaultValue={trip.members.length || 1}
                  required
                />
              </Field>
            </div>
            <Field label="预算下限（元，全部旅伴）">
              <input
                name="minBudget"
                defaultValue="0"
                inputMode="decimal"
                required
              />
            </Field>
            <details className="travel-profile-fields" open>
              <summary>精细攻略 · 同行与出行条件</summary>
              <p className="form-note">
                留空的信息将按假设处理并标注；不会替你编造航班、酒店或联系方式。预算为全部旅伴合计。
              </p>
              <div className="form-row">
                <Field label="出发城市">
                  <input
                    name="departure"
                    maxLength={60}
                    defaultValue={trip.travelProfile?.departure}
                    placeholder="例如：上海"
                  />
                </Field>
                <Field label="住宿夜数">
                  <input
                    name="nights"
                    type="number"
                    min="0"
                    max="30"
                    defaultValue={
                      trip.travelProfile?.nights ??
                      Math.max(0, trip.days.length - 1)
                    }
                    required
                  />
                </Field>
              </div>
              {(
                [
                  ["season", "季节与天气偏好", "例如：秋季，避开雨天徒步", 100],
                  [
                    "arrivalDeparture",
                    "到达与返程时间",
                    "例如：首日14点抵达，末日18点高铁",
                    200,
                  ],
                  [
                    "companions",
                    "同行人构成与体力",
                    "例如：2位成人+6岁孩子，每天步行不超过5公里",
                    300,
                  ],
                  [
                    "accommodation",
                    "住宿偏好 / 房型 / 早餐",
                    "例如：地铁附近酒店，双床房，含早、有电梯",
                    200,
                  ],
                  [
                    "transport",
                    "交通偏好",
                    "例如：公共交通优先，累时打车",
                    150,
                  ],
                  ["diet", "饮食禁忌与过敏", "例如：不吃辣、花生过敏", 200],
                  ["mustDo", "必去 / 必吃 / 必体验", "没有可填无", 300],
                  [
                    "avoid",
                    "不想去与避雷",
                    "例如：不爬山、不排队超过30分钟",
                    300,
                  ],
                  [
                    "budgetIncludes",
                    "预算包含哪些费用",
                    "例如：含往返交通住宿餐饮门票，不含购物",
                    200,
                  ],
                  ["other", "其他要求", "例如：婴儿车、无障碍、摄影时段", 300],
                ] as const
              ).map(([name, label, placeholder, maxLength]) => (
                <Field key={name} label={label}>
                  <input
                    name={name}
                    maxLength={maxLength}
                    defaultValue={trip.travelProfile?.[name]}
                    placeholder={placeholder}
                  />
                </Field>
              ))}
            </details>
            <label className="mb-4 block">
              <input
                type="checkbox"
                checked={detailedGuide}
                onChange={(e) => setDetailedGuide(e.target.checked)}
              />{" "}
              生成完整精细攻略（路线后补全4组手册，增加模型用量）
            </label>
            <Field label="旅行节奏">
              <div className="pace-options">
                {(
                  [
                    ["relaxed", "慢慢来", "每天留白"],
                    ["balanced", "刚刚好", "松弛有度"],
                    ["packed", "充实点", "不负好时光"],
                  ] as const
                ).map(([id, name, desc]) => (
                  <button
                    type="button"
                    key={id}
                    className={pace === id ? "selected" : ""}
                    onClick={() => setPace(id)}
                  >
                    <strong>{name}</strong>
                    <small>{desc}</small>
                    {pace === id && <Check size={12} />}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="这次，你更想体验">
              <div className="interest-options">
                {[
                  "自然风光",
                  "当地美食",
                  "人文历史",
                  "拍照打卡",
                  "亲子时光",
                  "冒险探索",
                  "慢节奏",
                ].map((tag) => (
                  <button
                    type="button"
                    className={interests.includes(tag) ? "selected" : ""}
                    key={tag}
                    onClick={() =>
                      setInterests(
                        interests.includes(tag)
                          ? interests.filter((t) => t !== tag)
                          : [...interests, tag],
                      )
                    }
                  >
                    {interests.includes(tag) && <Check size={12} />} {tag}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="选店与榜单核验偏好">
              <div className="reference-options">
                {referenceChoices.map((choice) => (
                  <button
                    type="button"
                    key={choice.id}
                    title={choice.description}
                    className={
                      preferences.includes(choice.id) ? "selected" : ""
                    }
                    onClick={() =>
                      setPreferences(
                        preferences.includes(choice.id)
                          ? preferences.filter((p) => p !== choice.id)
                          : [...preferences, choice.id],
                      )
                    }
                  >
                    {preferences.includes(choice.id) && <Check size={12} />}{" "}
                    {choice.name}
                  </button>
                ))}
              </div>
              <small>用于候选筛选和核验，不代表已接入实时榜单或已上榜。</small>
            </Field>
            <Field label="参考店铺、榜单链接或文字（选填）">
              <textarea
                value={references}
                maxLength={1500}
                onChange={(e) => setReferences(e.target.value)}
                placeholder="例如：想吃片儿川、不吃辣；粘贴你收藏的点评店名、榜单年份与门店信息。"
              />
              <small>
                离线参考仅保留供对照；AI
                模式会将文字作为未核验参考传给模型，不自动抓取链接。
              </small>
            </Field>
            <label>
              <input
                type="checkbox"
                checked={newTrip}
                onChange={(e) => {
                  setNewTrip(e.target.checked);
                  if (e.target.checked) {
                    setTarget("all");
                    setResult(null);
                  }
                }}
              />{" "}
              保存为一场新的旅行
            </label>
            <Field label="生成范围">
              <select
                value={target}
                disabled={newTrip}
                onChange={(e) => {
                  setTarget(e.target.value);
                  setResult(null);
                }}
              >
                <option value="all">整份旅行攻略</option>
                {trip.days.map((d, i) => (
                  <option key={d.id} value={String(i)}>
                    只重新规划第 {i + 1} 天
                  </option>
                ))}
              </select>
            </Field>
            {error && (
              <div className="inline-error" role="alert">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => {
                    const saved = loadPlanDraft();
                    if (
                      !offline &&
                      saved?.context?.userId === state.userId &&
                      saved.context.tripId === trip.id
                    )
                      void run(saved.input, false, saved.context, true);
                    else if (draft) void run(draft, offline);
                  }}
                >
                  重新尝试
                </button>
                {failureKind === "configuration" && (
                  <button type="button" onClick={() => setView("settings")}>
                    查看 AI 配置
                  </button>
                )}
                {(failureKind === "network" ||
                  failureKind === "timeout" ||
                  failureKind === "service") &&
                  healthURL() && (
                    <a href={healthURL()} target="_blank" rel="noreferrer">
                      打开后端健康检查 ↗
                    </a>
                  )}
              </div>
            )}
            <Button type="submit" className="full-width" disabled={busy}>
              {busy ? (
                <LoaderCircle size={18} className="spin" />
              ) : (
                <WandSparkles size={18} />
              )}{" "}
              {busy ? "正在寻找好灵感…" : "生成 AI 攻略"}
            </Button>
            <Button
              type="submit"
              name="mode"
              value="offline"
              variant="secondary"
              className="full-width mt-3"
              disabled={busy}
            >
              生成离线参考
            </Button>
            <p className="planner-disclaimer">
              <Info size={13} />
              {
                "AI 按天生成，会计入模型用量；更改参数或模型会开始新草稿。离线参考不调用模型。"
              }
            </p>
          </form>
        </section>
        <section className="planner-result">
          {busy ? (
            <div className="generation-state">
              <div className="ai-orb">
                <Sparkles size={36} />
              </div>
              <h2>正在把你的向往，拼成一段旅途…</h2>
              <p aria-live="polite">
                {offline
                  ? "正在整理离线参考路线。"
                  : progress?.phase === "handbook"
                    ? `每日路线已完成 · 旅行手册已完成 ${progress.guideCompleted}/${progress.guideTotal} 组`
                    : progress
                      ? `已完成 ${progress.completed}/${progress.total} 天 · ${stopping ? "正在保留当前一天的结果…" : `正在生成第 ${progress.currentDay} 天`}`
                      : "正在准备逐日生成…"}
              </p>
              <div className="generation-progress">
                <span />
              </div>
              <small>
                {offline
                  ? "离线参考不调用真实模型。"
                  : "每天单独生成并保留草稿，完成后合并。模型请求可能产生费用。"}
              </small>
              {!offline && (
                <Button
                  variant="secondary"
                  disabled={stopping}
                  onClick={() => {
                    control.current?.abort();
                    setStopping(true);
                  }}
                >
                  {stopping ? "等待当前请求结束…" : "完成当前请求后停止"}
                </Button>
              )}
              {progress && !progress.persisted && (
                <p className="form-note">
                  浏览器存储不可用，已完成部分暂存于当前页面；请勿刷新或关闭。
                </p>
              )}
            </div>
          ) : result ? (
            <div className="plan-preview panel">
              <span className="pill pill-purple">
                <Sparkles size={13} />
                {offline ? "离线参考 · 非 AI" : "AI 生成 · 请核验"}
              </span>
              <h2>{result.title}</h2>
              <h3>一、攻略概览</h3>
              <p>{result.summary}</p>
              {input?.references && (
                <div className="provided-references">
                  <strong>你提供的参考 · 未联网核验</strong>
                  <p>{input.references}</p>
                </div>
              )}
              <div className="plan-warning">
                <Info size={17} />
                <div>
                  {result.assumptions.map((a, i) => (
                    <p key={i}>{a}</p>
                  ))}
                </div>
              </div>
              <TravelHandbook plan={result} input={input || undefined} />
              {result.days.map((d, i) => (
                <div className="preview-day" key={i}>
                  <span>
                    DAY{" "}
                    {String(
                      target === "all" ? i + 1 : Number(target) + 1,
                    ).padStart(2, "0")}
                  </span>
                  <h3>{d.theme}</h3>
                  {d.practical && (
                    <p className="form-note">
                      机动留白 {d.practical.bufferMinutes} 分钟 ·{" "}
                      {d.practical.bufferPlan}
                    </p>
                  )}
                  <Coverage items={d.items} />
                  {d.items.map((a, j) => (
                    <article className="detailed-preview-item" key={j}>
                      <div className="preview-item">
                        <time>{a.time}</time>
                        <span>
                          {a.slot && (
                            <em className="guide-slot">{slotLabels[a.slot]}</em>
                          )}
                          <strong>{a.name}</strong>
                          <small>
                            {a.duration} 分钟 · 全员预估 ¥{money(a.costMinor)}
                            {input
                              ? ` · 人均约 ¥${money(Math.floor(a.costMinor / input.travelers))}`
                              : ""}
                          </small>
                          <small>{a.address}</small>
                        </span>
                      </div>
                      <Recommendation item={a} />
                    </article>
                  ))}
                </div>
              ))}
              <div className="plan-apply">
                <p>
                  保存时自动生成行前清单（含7／3／1天检查）和费用预估；改变人数时会创建新旅行。
                </p>
                <Field label="追问调整（如：第二天换成室内项目）">
                  <textarea
                    value={adjust}
                    onChange={(e) => setAdjust(e.target.value)}
                    maxLength={500}
                  />
                </Field>
                <Button
                  variant="secondary"
                  disabled={busy || !adjust.trim() || !input}
                  onClick={() => {
                    if (input)
                      void run({
                        ...input,
                        adjustment: adjust,
                        previousPlan: planContextText(result),
                      });
                  }}
                >
                  用 AI 调整这份攻略
                </Button>
                <p>
                  {target === "all"
                    ? "保存将替换当前旅行的全部日程；账单和清单保留。"
                    : "只替换所选日的安排，其他日程、账单和清单保留。"}
                </p>
                <Button
                  disabled={applied || (!newTrip && !canEdit)}
                  onClick={async () => {
                    if (!input) return;
                    if (newTrip || input.travelers !== trip.members.length) {
                      await createTrip(
                        newPlannedTrip(
                          result,
                          input,
                          state.userId,
                          state.profile.name,
                        ),
                      );
                      return;
                    }
                    if (
                      await updateTrip((t) =>
                        applyPlan(
                          t,
                          result,
                          input,
                          target === "all" ? undefined : Number(target),
                          state.userId,
                        ),
                      )
                    ) {
                      clearPlanDraft();
                      setAvailableDraft(null);
                      setApplied(true);
                      notify("攻略已保存，可以继续编辑每一项安排");
                    }
                  }}
                >
                  {applied ? <CheckCheck size={17} /> : <Check size={17} />}{" "}
                  {applied
                    ? "已保存到行程"
                    : newTrip
                      ? "创建旅行并保存"
                      : "保存到当前旅行"}
                </Button>
                {applied && (
                  <Button variant="secondary" onClick={() => setView("trips")}>
                    去看我的行程
                    <ArrowRight size={15} />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="planner-empty">
              <div className="empty-art">
                <span className="art-orbit" />
                <span className="art-mountain">△</span>
                <Sparkles size={34} />
                <span className="art-pin">
                  <MapPin size={22} />
                </span>
              </div>
              <span className="eyebrow">A JOURNEY THAT FEELS LIKE YOU</span>
              <h2>旅行，本来就可以简单一点。</h2>
              <p>
                一座想去的城市，几个喜欢的人，
                <br />
                再加上一点点出发的勇气。
              </p>
              <div className="planner-promises">
                <span>
                  <Check size={14} /> 三餐茶歇都安排
                </span>
                <span>
                  <Check size={14} /> 景点逛街有备选
                </span>
                <span>
                  <Check size={14} /> 点评榜单可核验
                </span>
              </div>
              <small>攻略是起点，旅途的故事由你书写。</small>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
