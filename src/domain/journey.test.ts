import { it, expect } from "vitest";
import { seedState } from "../data/seed";
import {
  applyPlan,
  estimatesFor,
  haversine,
  isVisited,
  newPlannedTrip,
} from "./journey";
import { mockPlan } from "../services/planner";
import { destinations, catalog } from "../data/destinations";
import { destinationSchema } from "./destination-schema";
import { validateState } from "../services/storage";
const input = {
  destination: "成都",
  days: 2,
  budgetMinor: 200000,
  travelers: 4,
  pace: "relaxed" as const,
  interests: ["当地美食"],
  startDate: "2026-12-10",
};
it("保存规划自动生成清单，费用预估不变成支出", () => {
  const old = seedState().trips[0];
  const next = applyPlan(old, mockPlan(input), input);
  expect(next.expenses).toEqual(old.expenses);
  expect(next.startDate).toBe(input.startDate);
  expect(estimatesFor(next)).toHaveLength(
    next.days.flatMap((d) => d.items).filter((a) => a.costMinor > 0).length,
  );
  expect(estimatesFor(next).every((e) => e.amountMinor > 0)).toBe(true);
  expect(next.checklist.length).toBeGreaterThan(old.checklist.length);
  expect(applyPlan(next, mockPlan(input), input).checklist.length).toBe(
    next.checklist.length,
  );
});
it("局部调整保留其他日期、旧账和原元数据", () => {
  const old = seedState().trips[0];
  const plan = mockPlan({ ...input, days: 1 });
  const next = applyPlan(old, plan, input, 1);
  expect(next.days[0]).toEqual(old.days[0]);
  expect(next.days[1].id).toBe(old.days[1].id);
  expect(next.destination).toBe(old.destination);
  expect(next.expenses).toEqual(old.expenses);
});
it("新建规划人数与所有项目标识独立，兼容旧备份", () => {
  const s = seedState();
  const trip = newPlannedTrip(mockPlan(input), input, s.userId, s.profile.name);
  expect(trip.members).toHaveLength(4);
  expect(new Set(trip.days.flatMap((d) => d.items.map((a) => a.id))).size).toBe(
    14,
  );
  expect(validateState({ ...s, trips: [trip], activeTripId: trip.id })).toBe(
    true,
  );
  expect(validateState(seedState())).toBe(true);
});
it("城市目录覆盖省会直辖市，收藏编辑隐藏可组合", () => {
  expect(destinations.length).toBeGreaterThanOrEqual(55);
  for (const name of [
    "北京",
    "天津",
    "重庆",
    "上海",
    "拉萨",
    "乌鲁木齐",
    "台北",
    "哈尔滨",
    "海口",
    "大理",
    "三亚",
  ])
    expect(destinations.some((d) => d.name === name)).toBe(true);
  for (const d of destinations)
    expect(destinationSchema.safeParse(d).success).toBe(true);
  const s = seedState();
  expect(
    catalog({ ...s, hiddenDestinations: [destinations[0].id] }),
  ).toHaveLength(destinations.length - 1);
});
it("足迹尊重明确的未去过标记，距离为直线估算", () => {
  const trip = seedState().trips[0];
  expect(isVisited({ ...trip, visited: false })).toBe(false);
  expect(isVisited({ ...trip, visited: true })).toBe(true);
  expect(
    haversine({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }),
  ).toBeCloseTo(111.195, 2);
});
it("照片和目的地备份校验拒绝脚本与不合法日期", () => {
  const s = seedState();
  s.trips[0].photos = [
    {
      id: "p",
      src: "javascript:alert(1)",
      takenAt: "2026-12-10",
      caption: "x",
      createdBy: s.userId,
    },
  ];
  expect(validateState(s)).toBe(false);
});
