import { expect, it } from "vitest";
import { assertGuideQuality } from "./plan-quality";
import { mockPlan } from "../services/planner";
const input = {
  destination: "杭州",
  days: 1,
  travelers: 2,
  budgetMinor: 100000,
  pace: "balanced" as const,
  interests: [],
  detailedGuide: true,
};
it("精细攻略拒绝缺失执行字段、交叠时间、虚假机动分钟与矛盾费用区间", () => {
  const base = mockPlan(input);
  expect(() => assertGuideQuality(base, input)).not.toThrow();
  const missing = structuredClone(base);
  delete missing.days[0].items[0].execution;
  expect(() => assertGuideQuality(missing, input)).toThrow("精细行程");
  const overlap = structuredClone(base);
  overlap.days[0].items[1].time = "08:15";
  expect(() => assertGuideQuality(overlap, input)).toThrow("时间重叠");
  const buffer = structuredClone(base);
  buffer.days[0].items.forEach((a) => (a.duration = 1));
  buffer.days[0].items.forEach(
    (a, i) => (a.time = `08:${String(i).padStart(2, "0")}`),
  );
  expect(() => assertGuideQuality(buffer, input)).toThrow("机动时间");
  const money = structuredClone(base);
  money.days[0].items[0].execution!.minMinor =
    money.days[0].items[0].costMinor + 1;
  expect(() => assertGuideQuality(money, input)).toThrow("费用区间");
});
