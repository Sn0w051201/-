import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { planSchema } from "../src/domain/plan-schema";
import {
  guideSlotSchema,
  recommendationDetailsSchema,
} from "../src/domain/recommendation-schema";

const day = planSchema.shape.days.element;
const activity = day.shape.items.element;
// The provider requires every property, using null when a coordinate is unknown.
// Internal and persisted records continue using absent optional coordinates.
const wireActivity = activity.extend({
  execution: activity.shape.execution.unwrap().nullable(),
  lat: activity.shape.lat.unwrap().nullable(),
  lng: activity.shape.lng.unwrap().nullable(),
  slot: guideSlotSchema,
  details: recommendationDetailsSchema,
});
const wirePlan = planSchema.omit({ handbook: true }).extend({
  days: z
    .array(
      day.extend({
        practical: day.shape.practical.unwrap().nullable(),
        items: z.array(wireActivity).min(7).max(8),
      }),
    )
    .min(1)
    .max(14),
});

/** Limit to the portable Structured Outputs subset. Length/range constraints remain enforced by Zod. */
export function portableSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(portableSchema);
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  const bounds = [
    ["minLength", "最少字符"],
    ["maxLength", "最多字符"],
    ["minimum", "最小值"],
    ["maximum", "最大值"],
    ["minItems", "最少项数"],
    ["maxItems", "最多项数"],
    ["pattern", "格式正则"],
  ] as const;
  const descriptions = bounds
    .filter(([key]) => input[key] !== undefined)
    .map(([key, label]) => `${label}：${input[key]}`);
  for (const key of [
    "type",
    "enum",
    "required",
    "additionalProperties",
    "$ref",
    "description",
  ])
    if (Object.hasOwn(input, key)) output[key] = input[key];
  if (descriptions.length)
    output.description = [input.description, ...descriptions]
      .filter(Boolean)
      .join("；");
  for (const key of ["properties", "$defs", "definitions"])
    if (input[key])
      output[key] = Object.fromEntries(
        Object.entries(input[key] as Record<string, unknown>).map(
          ([name, schema]) => [name, portableSchema(schema)],
        ),
      );
  for (const key of ["items", "anyOf", "oneOf"])
    if (input[key]) output[key] = portableSchema(input[key]);
  return output;
}
export const strictPlanResponseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "moodnomad_travel_plan",
    strict: true,
    schema: portableSchema(
      zodToJsonSchema(wirePlan, { target: "openAi", $refStrategy: "none" }),
    ),
  },
};
export function planResponseFormat(hostname: string, model: string) {
  const structured =
    model === "gpt-4o" ||
    /^gpt-4o-mini(?:-|$)/.test(model) ||
    /^gpt-4\.1(?:-|$)/.test(model) ||
    ["gpt-4o-2024-08-06", "gpt-4o-2024-11-20"].includes(model);
  return hostname === "api.openai.com" && structured
    ? strictPlanResponseFormat
    : { type: "json_object" as const };
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const moneyMetadata = [
  "currency",
  "currencyCode",
  "costUnit",
  "amountUnit",
  "costCurrency",
  "moneyUnit",
];
function pick(value: Record<string, unknown>, keys: readonly string[]) {
  // Retain explicit currency/unit declarations so the strict schema rejects
  // them rather than silently interpreting a foreign amount as CNY cents.
  return Object.fromEntries(
    [...new Set([...keys, ...moneyMetadata])]
      .filter((k) => Object.hasOwn(value, k))
      .map((k) => [k, value[k]]),
  );
}
function integer(value: unknown) {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    if (Number.isSafeInteger(n)) return n;
  }
  return value;
}
const fields = [
  "execution",
  "name",
  "time",
  "duration",
  "type",
  "costMinor",
  "note",
  "address",
  "lat",
  "lng",
  "slot",
  "details",
] as const;
const detailFields = [
  "reason",
  "highlights",
  "transport",
  "reservation",
  "alternatives",
  "sources",
] as const;
/** No invented activities, costs, reasons or coordinates; only representation changes. */
export function normalizePlanOutput(value: unknown): unknown {
  if (!record(value)) return value;
  const result = pick(value, ["title", "summary", "assumptions", "days"]);
  if (Array.isArray(result.days))
    result.days = result.days.map((d) => {
      if (!record(d)) return d;
      const next = pick(d, ["theme", "items", "practical"]);
      if (next.practical === null) delete next.practical;
      if (Array.isArray(next.items))
        next.items = next.items.map((raw) => {
          if (!record(raw)) return raw;
          const item = pick(raw, fields);
          if (item.execution === null) delete item.execution;
          for (const key of ["lat", "lng"] as const)
            if (item[key] === null) delete item[key];
          for (const key of ["duration", "costMinor"] as const)
            if (Object.hasOwn(item, key)) item[key] = integer(item[key]);
          if (
            typeof item.time === "string" &&
            /^\d:\d{2}$/.test(item.time.trim())
          )
            item.time = "0" + item.time.trim();
          if (record(item.details)) {
            const details = pick(item.details, detailFields);
            if (Array.isArray(details.sources))
              details.sources = details.sources.map((source) =>
                record(source) ? pick(source, ["platform", "query"]) : source,
              );
            item.details = details;
          }
          return item;
        });
      return next;
    });
  return result;
}
const names: Record<string, string> = {
  title: "标题",
  summary: "摘要",
  assumptions: "说明",
  days: "行程天数",
  theme: "当日主题",
  items: "活动",
  name: "名称",
  time: "时间",
  duration: "耗时分钟",
  type: "活动类型",
  costMinor: "预估费用（整数分）",
  note: "备注",
  address: "地址",
  lat: "纬度",
  lng: "经度",
  slot: "时段",
  details: "推荐详情",
  reason: "推荐理由",
  highlights: "体验亮点",
  transport: "交通衔接",
  reservation: "预约提示",
  alternatives: "备选方案",
  sources: "核验渠道",
  platform: "平台",
  query: "检索词",
};
export function outputIssueSummary(issues: z.ZodIssue[]) {
  return issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path
        .map((part) =>
          typeof part === "number" ? `第${part + 1}项` : names[part] || "字段",
        )
        .join("/");
      let problem = "不符合要求";
      if (issue.code === "invalid_type")
        problem = issue.received === "undefined" ? "缺失" : "类型不正确";
      if (issue.code === "too_big") problem = `超出上限${issue.maximum}`;
      if (issue.code === "too_small") problem = `不足下限${issue.minimum}`;
      if (issue.code === "invalid_enum_value") problem = "不在允许选项内";
      if (issue.code === "invalid_string") problem = "格式不正确";
      if (issue.code === "unrecognized_keys")
        problem = issue.keys.some((k) => moneyMetadata.includes(k))
          ? "金额单位不明确，须仅使用人民币整数分字段"
          : "包含未支持字段";
      return `${path || "攻略"}：${problem}`;
    })
    .join("；");
}
