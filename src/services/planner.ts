import { AIRequestError } from "./ai-errors";
import { detailedPlan } from "../data/guides";
import { getAISettings, proxyURL } from "./ai-settings";
import { cloudCall } from "./cloud";
import { planInputSchema, planSchema } from "../domain/plan-schema";
export { planInputSchema, planSchema } from "../domain/plan-schema";
import type { GeneratedPlan, PlanInput } from "../domain/types";
export function mockPlan(input: PlanInput): GeneratedPlan {
  planInputSchema.parse(input);
  return detailedPlan(input);
}
export async function generatePlan(input: PlanInput): Promise<GeneratedPlan> {
  if (import.meta.env.VITE_DATA_MODE === "cloud") {
    return planSchema.parse(await cloudCall("generatePlan", { input }));
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
        provider: settings.provider,
        model: settings.model,
        key: settings.key,
      }),
      signal: AbortSignal.timeout(120000),
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
    throw new AIRequestError(
      error,
      response.status === 401 || /密钥|模型配置/.test(error)
        ? "configuration"
        : "service",
    );
  }
  const parsed = planSchema.safeParse(data);
  if (!parsed.success)
    throw new AIRequestError(
      "代理返回的攻略结构不完整，本次没有保存。请稍后重试或缩短旅行天数。",
      "output",
    );
  return parsed.data;
}
