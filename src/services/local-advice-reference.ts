import type { GeneratedPlan, PlanInput } from "../domain/types";
/** Offline guidance preserves the route and never assigns an unverified commercial venue. */
export function enrichLocalAdvice(
  input: PlanInput,
  plan: GeneratedPlan,
): GeneratedPlan {
  const preferences = input.travelProfile?.localRecommendations;
  if (!preferences) return plan;
  for (const day of plan.days)
    for (const item of day.items) {
      if (!item.details) continue;
      const food = item.type === "food" || item.type === "rest";
      item.details.localAdvice = {
        candidateId: null,
        styles: preferences.styles.length ? preferences.styles : ["当地特色"],
        mustTry: food
          ? item.details.highlights.slice(0, 2)
          : ["优先体验本活动已有亮点，具体项目先核验"],
        playTips: food
          ? [`优先在${preferences.area || "当天游览片区"}选店，点小份后再加菜`]
          : ["先确认开放入口与预约，再按体力选择体验"],
        avoidTips: [
          food
            ? "过敏原、辣度和隐形收费须向门店确认"
            : "高价加购和不明揽客项目先不选",
        ],
        hoursTip: "未联网核实营业时间【需出发前核实】",
        queueTip: `等待超过${preferences.queueToleranceMinutes}分钟就换同片区备选`,
        reservationTip:
          preferences.reservation === "avoid"
            ? "优先无需预约场所，实际规则仍需核实"
            : "核验官方预约方式，不购买来源不明门票",
        suitableFor:
          input.travelProfile?.companions ||
          "按同行年龄体力核实，儿童老人留足休息",
      };
    }
  return plan;
}
