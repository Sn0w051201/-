import { expect, it } from "vitest";
import { groundLocalAdvice } from "./ground-local-advice";
import {
  placeCandidateSchema,
  completePlaceAddress,
  placeCopyText,
  placeNavigationURL,
} from "./local-advice";
import type { PlanInput } from "./types";
import { mockPlan } from "../services/planner";
import { applyPlan } from "./journey";
import { validateTrip } from "./trip-schema";
import { seedState } from "../data/seed";
const candidate = {
  id: "provided-one",
  category: "food" as const,
  name: "测试资料餐厅（非真实推荐）",
  fullAddress: "浙江省杭州市西湖区测试路1号2层",
  source: "大众点评" as const,
  sourceUrl: "https://www.dianping.com/",
  sourceNote: "单元测试，模拟用户来源",
  observedAt: "2026-10-21",
  avgPriceMinor: 8000,
};
const input: PlanInput = {
  destination: "杭州",
  days: 1,
  budgetMinor: 100000,
  travelers: 2,
  pace: "relaxed",
  interests: [],
  placeCandidates: [candidate],
  travelProfile: {
    departure: "上海",
    nights: 0,
    season: "秋",
    arrivalDeparture: "",
    companions: "2位成人",
    accommodation: "",
    transport: "",
    diet: "不吃辣",
    mustDo: "",
    avoid: "",
    other: "",
    budgetIncludes: "",
    localRecommendations: {
      styles: ["当地特色"],
      foodTypes: ["本地菜"],
      playTypes: ["手作"],
      area: "西湖附近",
      maxPerPersonMinor: 8000,
      queueToleranceMinutes: 15,
      reservation: "avoid",
    },
  },
};
it("复制包含店名与完整地址，地址缺失只复制搜索名称", () => {
  expect(completePlaceAddress(candidate.fullAddress)).toBe(true);
  expect(placeCopyText(candidate.name, candidate.fullAddress)).toContain(
    candidate.fullAddress,
  );
  expect(placeCopyText(candidate.name, "杭州市西湖区")).toContain(
    "暂无完整地址",
  );
  expect(placeNavigationURL(candidate.name, candidate.fullAddress)).toContain(
    encodeURIComponent(candidate.fullAddress),
  );
});
it("点评来源必须为安全点评链接，日期有效，金额整数分", () => {
  expect(placeCandidateSchema.safeParse(candidate).success).toBe(true);
  for (const sourceUrl of [
    "not-a-url",
    "javascript:alert(1)",
    "https://dianping.com.evil.example/x",
    "https://user:pass@www.dianping.com/",
  ])
    expect(
      placeCandidateSchema.safeParse({ ...candidate, sourceUrl }).success,
    ).toBe(false);
  expect(
    placeCandidateSchema.safeParse({ ...candidate, avgPriceMinor: 80.5 })
      .success,
  ).toBe(false);
  expect(
    placeCandidateSchema.safeParse({ ...candidate, observedAt: "2026-02-30" })
      .success,
  ).toBe(false);
});
it("事实由服务器原样附加，拒绝候选之外的店铺和无来源门牌", () => {
  const plan = mockPlan(input);
  const item = plan.days[0].items[0];
  item.details!.localAdvice!.candidateId = candidate.id;
  item.name = "模型改写的店名";
  item.address = "模型改写的地址";
  groundLocalAdvice(plan, input);
  expect(item.name).toBe(candidate.name);
  expect(item.address).toBe(candidate.fullAddress);
  expect(item.place).toEqual(candidate);
  item.details!.localAdvice!.candidateId = "invented-id";
  expect(() => groundLocalAdvice(plan, input)).toThrow("用户资料以外");
  item.details!.localAdvice!.candidateId = null;
  item.address = "无来源街道99号";
  expect(() => groundLocalAdvice(plan, input)).toThrow("无来源");
});
it("丰富建议、候选和偏好随行程保存，保持账本原支出", () => {
  const plan = mockPlan(input);
  plan.days[0].items[0].details!.localAdvice!.candidateId = candidate.id;
  groundLocalAdvice(plan, input);
  const old = seedState().trips[0];
  const saved = validateTrip(applyPlan(old, plan, input));
  expect(saved.days[0].items[0].place).toEqual(candidate);
  expect(
    saved.days[0].items[0].details?.localAdvice?.mustTry.length,
  ).toBeGreaterThan(0);
  expect(saved.travelProfile?.localRecommendations?.queueToleranceMinutes).toBe(
    15,
  );
  expect(saved.placeCandidates).toEqual([candidate]);
  expect(saved.expenses).toEqual(old.expenses);
});
