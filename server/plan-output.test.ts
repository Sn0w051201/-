import { it, expect } from "vitest";
import {
  normalizePlanOutput,
  outputIssueSummary,
  planResponseFormat,
  strictPlanResponseFormat,
} from "./plan-output";
import { planSchema } from "../src/domain/plan-schema";
import { mockPlan } from "../src/services/planner";
import { applyPlan } from "../src/domain/journey";
import { seedState } from "../src/data/seed";
import { validateTrip } from "../src/domain/trip-schema";
const input = {
  destination: "大理",
  days: 2,
  travelers: 4,
  budgetMinor: 800000,
  pace: "relaxed" as const,
  interests: [],
};
it("OpenAI 默认模型使用无可选字段的严格结构，其它平台保留JSON兼容模式", () => {
  expect(planResponseFormat("api.openai.com", "gpt-4o-mini").type).toBe(
    "json_schema",
  );
  expect(planResponseFormat("api.deepseek.com", "deepseek-chat")).toEqual({
    type: "json_object",
  });
  expect(planResponseFormat("api.openai.com", "gpt-3.5-turbo").type).toBe(
    "json_object",
  );
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const schema = node as Record<string, any>;
    if (schema.type === "object") {
      expect(schema.additionalProperties).toBe(false);
      expect([...schema.required].sort()).toEqual(
        Object.keys(schema.properties).sort(),
      );
      Object.values(schema.properties).forEach(visit);
    }
    if (schema.items) visit(schema.items);
    if (schema.anyOf) schema.anyOf.forEach(visit);
    expect(schema).not.toHaveProperty("maxLength");
    expect(schema).not.toHaveProperty("minLength");
    expect(schema).not.toHaveProperty("$schema");
  };
  visit(strictPlanResponseFormat.json_schema.schema);
  const schema = strictPlanResponseFormat.json_schema.schema as any;
  const props = schema.properties.days.items.properties.items.items.properties;
  expect(props.costMinor.type).toBe("integer");
  expect(JSON.stringify(props.lat)).toContain("null");
  expect(props.details.properties.reason.description).toContain("250");
});
it("安全兼容空坐标、时间写法、整数数字字符串和无关元数据，并可保存为真实行程", () => {
  const raw: any = mockPlan(input);
  raw.destination = "大理";
  raw.days[0].date = "2026-11-01";
  const activity = raw.days[0].items[0];
  activity.id = "provider-id";
  activity.done = true;
  activity.lat = null;
  activity.lng = null;
  activity.time = "9:05";
  activity.duration = "60";
  activity.costMinor = "1234";
  activity.details.sources[0].verified = true;
  const parsed = planSchema.parse(normalizePlanOutput(raw));
  const item = parsed.days[0].items[0];
  expect(item.time).toBe("09:05");
  expect(item.duration).toBe(60);
  expect(item.costMinor).toBe(1234);
  expect(item.lat).toBeUndefined();
  expect(item.lng).toBeUndefined();
  expect(item).not.toHaveProperty("id");
  expect(item.details?.sources[0]).not.toHaveProperty("verified");
  const trip = seedState().trips[0];
  const saved = validateTrip(applyPlan(trip, parsed, input));
  expect(saved.days[0].items[0].done).toBe(false);
  expect(saved.days[0].items[0].costMinor).toBe(1234);
  expect(saved.expenses).toEqual(trip.expenses);
});
it("不猜测金额单位，不把缺失金额或坐标补成零，也不接受非法时间", () => {
  for (const amount of [
    undefined,
    null,
    "12.50",
    "¥12.5",
    "一百",
    1.5,
    -1,
    "9007199254740993",
  ]) {
    const raw: any = mockPlan(input);
    raw.days[0].items[0].costMinor = amount;
    expect(planSchema.safeParse(normalizePlanOutput(raw)).success).toBe(false);
  }
  for (const unit of [
    { currency: "USD" },
    { costUnit: "元" },
    { amountUnit: "美元" },
  ]) {
    const raw: any = mockPlan(input);
    Object.assign(raw.days[0].items[0], unit);
    expect(planSchema.safeParse(normalizePlanOutput(raw)).success).toBe(false);
  }
  const raw: any = mockPlan(input);
  raw.days[0].items[0].time = "9:99";
  expect(planSchema.safeParse(normalizePlanOutput(raw)).success).toBe(false);
  raw.days[0].items[0].time = "09:00";
  raw.days[0].items[0].lat = 100;
  expect(planSchema.safeParse(normalizePlanOutput(raw)).success).toBe(false);
});
it("超长必填说明仍拒绝，只给出字段位置和限制，不回显原始内容", () => {
  const raw = mockPlan(input);
  raw.days[0].items[0].details!.reason = "private-response-content".repeat(30);
  const checked = planSchema.safeParse(normalizePlanOutput(raw));
  expect(checked.success).toBe(false);
  if (!checked.success) {
    const summary = outputIssueSummary(checked.error.issues);
    expect(summary).toContain("推荐理由");
    expect(summary).toContain("250");
    expect(summary).not.toContain("private-response-content");
  }
});
