import type { GeneratedPlan, PlanInput } from "./types";
export function assertGuideQuality(plan: GeneratedPlan, input: PlanInput) {
  if (plan.days.length !== input.days) throw new Error("模型返回天数不一致");
  for (const day of plan.days) {
    if (input.detailedGuide) {
      if (!day.practical || day.items.some((a) => !a.execution))
        throw new Error("缺少精细行程的优先级、体力、营业核验或每日机动预案");
      if (
        day.items.some(
          (a) =>
            a.execution &&
            (a.execution.minMinor > a.costMinor ||
              a.execution.maxMinor < a.costMinor),
        )
      )
        throw new Error("活动费用区间与预估不一致");
      const intervals = day.items.map((a) => {
        const [h, m] = a.time.split(":").map(Number);
        return { start: h * 60 + m, end: h * 60 + m + a.duration };
      });
      if (
        intervals.some(
          (a, i) => a.end > 1440 || (i > 0 && a.start < intervals[i - 1].end),
        )
      )
        throw new Error("活动时间重叠或跨过午夜，请调整顺序与时长");
      const freeMinutes = intervals
        .slice(1)
        .reduce((n, a, i) => n + a.start - intervals[i].end, 0);
      if (freeMinutes < day.practical.bufferMinutes)
        throw new Error("未在活动之间预留足够机动时间");
    }
    for (const slot of [
      "breakfast",
      "morning",
      "lunch",
      "afternoon",
      "tea",
      "dinner",
      "evening",
    ])
      if (!day.items.some((a) => a.slot === slot))
        throw new Error("缺少三餐或吃喝玩乐安排");
    if (day.items.some((a) => !a.details))
      throw new Error("缺少推荐理由、交通或备选");
    if (
      day.items.reduce((n, a) => n + a.costMinor, 0) >
      Math.floor(input.budgetMinor / input.days)
    )
      throw new Error("日均预估超过预算");
  }
  const text = JSON.stringify(plan);
  if (
    /(?:评分|星级|好评率|排名)[：:\s]*\d|(?:点评|必吃榜).{0,12}第\s*\d+\s*名|米其林[一二三123]星|黑珍珠[一二三123]钻/.test(
      text,
    )
  )
    throw new Error("不允许无证据的评分或榜单声明");
}
