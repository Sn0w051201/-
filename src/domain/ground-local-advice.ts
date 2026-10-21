import type { GeneratedPlan, PlanInput } from "./types";
import { completePlaceAddress } from "./local-advice";
/** Copy immutable place facts from user-supplied candidates. AI never supplies a door number or source URL. */
export function groundLocalAdvice(
  plan: GeneratedPlan,
  input: PlanInput,
): GeneratedPlan {
  for (const day of plan.days)
    for (const item of day.items) {
      const id = item.details?.localAdvice?.candidateId;
      if (!id) {
        delete item.place;
        if (
          input.travelProfile?.localRecommendations &&
          ["food", "rest", "shopping", "nightlife"].includes(item.type)
        ) {
          delete item.lat;
          delete item.lng;
        }
        if (
          input.travelProfile?.localRecommendations &&
          ["food", "rest", "shopping", "nightlife"].includes(item.type) &&
          /[0-9]+\s*(号|层|楼|室)/.test(item.address)
        )
          throw new Error(
            "无来源店铺不能生成门牌地址，请改为选店片区并标注待核实",
          );
        continue;
      }
      const candidate = input.placeCandidates?.find((p) => p.id === id);
      if (!candidate)
        throw new Error(
          "推荐引用了用户资料以外的店铺，须使用已提供候选ID或留空",
        );
      if (
        candidate.category === "food" &&
        !["food", "rest"].includes(item.type)
      )
        throw new Error("餐饮候选须用于餐饮或茶歇时段");
      if (candidate.category === "play" && ["food", "rest"].includes(item.type))
        throw new Error("玩乐候选不能作为餐厅");
      item.place = { ...candidate };
      item.name = candidate.name;
      item.address = completePlaceAddress(candidate.fullAddress)
        ? candidate.fullAddress
        : candidate.fullAddress || "暂无完整地址【需核实】";
      delete item.lat;
      delete item.lng;
    }
  return plan;
}
