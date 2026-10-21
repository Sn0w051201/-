import { enrichReference } from "./handbook-reference";
import { validateHandbook } from "../domain/handbook-schema";
import type { Handbook } from "../domain/handbook-schema";
import { generateDailyPlan, planContextText } from "./plan-job";
import type { PlanJobOptions } from "./plan-job";
import { AIRequestError } from "./ai-errors";
import { detailedPlan } from "../data/guides";
import { getAISettings, proxyURL } from "./ai-settings";
import { cloudCall } from "./cloud";
import { planInputSchema, planSchema } from "../domain/plan-schema";
export { planInputSchema, planSchema } from "../domain/plan-schema";
import type { GeneratedPlan, PlanInput } from "../domain/types";
export function mockPlan(input: PlanInput): GeneratedPlan {
  planInputSchema.parse(input);
  return enrichReference(input, detailedPlan(input));
}
async function requestAI(
  input: PlanInput,
  handbook?: { group: number; plan: GeneratedPlan },
): Promise<unknown> {
  if (import.meta.env.VITE_DATA_MODE === "cloud") {
    return cloudCall(handbook ? "generateHandbook" : "generatePlan", {
      input,
      ...handbook,
    });
  }
  const settings = getAISettings();
  let url: string;
  try {
    url = proxyURL(settings.proxyUrl);
  } catch (e) {
    throw new AIRequestError((e as Error).message, "configuration");
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.token
          ? { Authorization: `Bearer ${settings.token}` }
          : {}),
      },
      body: JSON.stringify({
        input,
        ...(handbook ? { task: "handbook", ...handbook } : {}),
        provider: settings.provider,
        model: settings.model,
        key: settings.key,
      }),
      signal: AbortSignal.timeout(handbook ? 180000 : 120000),
    });
  } catch (e) {
    if (["TimeoutError", "AbortError"].includes((e as Error).name))
      throw new AIRequestError(
        "代理响应超时。Render 服务可能正在唤醒，或模型生成较慢。请先打开后端健康检查，确认正常后再重试。",
        "timeout",
      );
    throw new AIRequestError(
      "无法连接后端代理或读取响应。可能是跨域限制、服务尚未部署成功或网络不可达；这不能判断 API Key 是否有效。请先打开后端健康检查，稍候后重试。",
      "network",
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new AIRequestError(
      `代理返回了非 JSON 响应（HTTP ${response.status}）。请确认地址以 /api/ai 结尾；Render 可能正在唤醒或部署。`,
      "service",
    );
  }
  if (!response.ok) {
    const error =
      typeof (data as { error?: unknown })?.error === "string"
        ? (data as { error: string }).error.slice(0, 500)
        : `模型服务暂不可用（HTTP ${response.status}）`;
    const code =
      typeof (data as { code?: unknown })?.code === "string"
        ? (data as { code: string }).code
        : "";
    const kind =
      [
        "KEY_MISSING",
        "KEY_INVALID",
        "MODEL_NOT_FOUND",
        "MODEL_PARAMETERS",
        "MODEL_FORBIDDEN",
      ].includes(code) || response.status === 401
        ? "configuration"
        : code.startsWith("MODEL_OUTPUT_")
          ? "output"
          : code.startsWith("MODEL_")
            ? "model"
            : "service";
    throw new AIRequestError(error, kind);
  }

  return data;
}
export async function requestHandbook(
  input: PlanInput,
  group: number,
  plan: GeneratedPlan,
): Promise<Handbook> {
  const data = await requestAI(
    { ...input, previousPlan: undefined },
    { group, plan: JSON.parse(planContextText(plan)) },
  );
  try {
    return validateHandbook(data, group);
  } catch {
    throw new AIRequestError(
      "旅行手册未返回完整章节。请确认Render已部署支持完整手册的最新版本，再继续生成。",
      "output",
    );
  }
}
export async function requestPlan(input: PlanInput): Promise<GeneratedPlan> {
  const data = await requestAI(input);
  const parsed = planSchema.safeParse(data);
  if (!parsed.success)
    throw new AIRequestError(
      "代理返回的攻略结构不完整，本次没有保存。请稍后重试或缩短旅行天数。",
      "output",
    );
  return parsed.data;
}

export async function generatePlan(
  input: PlanInput,
  options: PlanJobOptions = {},
): Promise<GeneratedPlan> {
  const settings = getAISettings();
  const cloud = import.meta.env.VITE_DATA_MODE === "cloud";
  let endpoint = "";
  if (!cloud) {
    try {
      endpoint = proxyURL(settings.proxyUrl);
    } catch (e) {
      throw new AIRequestError((e as Error).message, "configuration");
    }
  }
  return generateDailyPlan(input, requestPlan, {
    ...options,
    requestHandbook,
    identity: JSON.stringify({
      provider: settings.provider,
      model: settings.model,
      proxyUrl: endpoint,
      cloud,
    }),
  });
}
