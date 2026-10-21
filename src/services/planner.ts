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
  const response = await fetch(proxyURL(settings.proxyUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(settings.token ? { Authorization: `Bearer ${settings.token}` } : {}),
    },
    body: JSON.stringify({
      input,
      provider: settings.provider,
      model: settings.model,
      key: settings.key,
    }),
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "模型服务暂不可用");
  return planSchema.parse(data);
}
