import { z } from "zod";
const text = z.string().trim().min(1).max(300);
export const travelProfileSchema = z
  .object({
    departure: z.string().max(60),
    nights: z.number().int().min(0).max(30),
    season: z.string().max(100),
    arrivalDeparture: z.string().max(200),
    companions: z.string().max(300),
    accommodation: z.string().max(200),
    transport: z.string().max(150),
    diet: z.string().max(200),
    mustDo: z.string().max(300),
    avoid: z.string().max(300),
    other: z.string().max(300),
    budgetIncludes: z.string().max(200),
  })
  .strict();
export const executionSchema = z
  .object({
    priority: z.enum(["必留", "可选", "可删"]),
    openingHours: text,
    effort: z.enum(["低", "中", "高"]),
    audience: text,
    minMinor: z.number().int().min(0).max(9999999999),
    maxMinor: z.number().int().min(0).max(9999999999),
  })
  .strict();
export const dayPracticalSchema = z
  .object({
    bufferMinutes: z.number().int().min(30).max(240),
    bufferPlan: text,
    rain: text,
    queue: text,
    closure: text,
    tired: text,
  })
  .strict();
export const handbookDefinitions = {
  basics: {
    title: "二、基础信息",
    columns: ["项目", "具体说明 / 适配提醒", "时效与核验"],
  },
  transport: {
    title: "四、交通方案",
    columns: [
      "类型 / 选择",
      "路线与时段",
      "方式 / 耗时",
      "费用参考",
      "购票 / 接驳 / 末班与核验",
    ],
  },
  stays: {
    title: "五、住宿建议",
    columns: [
      "区域",
      "适合人群",
      "预算 / 房型 / 早餐",
      "地铁 / 景点距离",
      "入住退房 / 寄存",
      "优缺点 / 电梯与安全",
    ],
  },
  food: {
    title: "六、美食与购物",
    columns: [
      "名称 / 区域",
      "吃什么 / 买什么",
      "预算参考",
      "营业 / 预约",
      "排队 / 避雷 / 退税",
      "适合人群",
    ],
  },
  sights: {
    title: "八、景点与体验重点",
    columns: [
      "景点 / 优先级",
      "为什么去",
      "拍照点 / 时段",
      "讲解 / 导览",
      "体力 / 人群",
      "时间不足时的取舍",
    ],
  },
  safety: {
    title: "九、注意事项与避坑",
    columns: ["主题", "具体提醒", "行动 / 核验"],
  },
  tools: {
    title: "十、实用工具与信息",
    columns: ["工具 / 信息", "用途 / 准备方式", "离线备份 / 核验"],
  },
  emergency: {
    title: "十一、应急与备选",
    columns: ["场景", "触发条件", "替代地点 / 行动", "交通 / 费用 / 核验"],
  },
  checkpoints: {
    title: "出发前检查清单",
    columns: ["时间", "检查事项", "完成标准"],
  },
} as const;
export type HandbookKey = keyof typeof handbookDefinitions;
export const handbookKeySchema = z.enum([
  "basics",
  "transport",
  "stays",
  "food",
  "sights",
  "safety",
  "tools",
  "emergency",
  "checkpoints",
]);
export const handbookSectionSchema = z
  .object({
    key: handbookKeySchema,
    rows: z.array(z.array(text).min(3).max(6)).min(2).max(12),
  })
  .strict();
export const budgetLineSchema = z
  .object({
    category: z.enum(["交通", "住宿", "餐饮", "门票", "购物", "保险", "其他"]),
    minMinor: z.number().int().min(0).max(9999999999),
    maxMinor: z.number().int().min(0).max(9999999999),
    note: text,
  })
  .strict();
export const handbookBundleSchema = z
  .object({
    sections: z.array(handbookSectionSchema).max(9),
    budget: z.array(budgetLineSchema).max(7),
  })
  .strict();
export const handbookGroups = [
  { title: "基础信息、交通与住宿", keys: ["basics", "transport", "stays"] },
  { title: "美食购物与景点取舍", keys: ["food", "sights"] },
  {
    title: "安全、实用工具与行前检查",
    keys: ["safety", "tools", "checkpoints"],
  },
  { title: "预算与应急预案", keys: ["emergency"] },
] as const;
export type TravelProfile = z.infer<typeof travelProfileSchema>;
export type Handbook = z.infer<typeof handbookBundleSchema>;
export function validateHandbook(value: unknown, group?: number): Handbook {
  const result = handbookBundleSchema.parse(value);
  const expected: readonly string[] =
    group === undefined
      ? Object.keys(handbookDefinitions)
      : handbookGroups[group]?.keys || [];
  if (
    !expected.length ||
    result.sections.length !== expected.length ||
    new Set(result.sections.map((s) => s.key)).size !== expected.length ||
    expected.some((k) => !result.sections.some((s) => s.key === k))
  )
    throw new Error("旅行手册章节不完整");
  for (const s of result.sections) {
    if (
      s.rows.some(
        (row) => row.length !== handbookDefinitions[s.key].columns.length,
      )
    )
      throw new Error("旅行手册表格列数不正确");
    if (s.key === "stays" && (s.rows.length < 2 || s.rows.length > 3))
      throw new Error("请对比2—3个住宿区域");
    if (
      s.key === "checkpoints" &&
      ["7天", "3天", "1天"].some(
        (t) => !s.rows.some((r) => r[0].replace(/\s/g, "").includes(t)),
      )
    )
      throw new Error("缺少出发前7天/3天/1天检查");
    if (
      s.key === "emergency" &&
      ["下雨", "排队", "闭馆", "延误", "体力", "票", "超支"].some(
        (t) => !s.rows.some((r) => r[0].includes(t)),
      )
    )
      throw new Error("应急场景不完整");
  }
  if (group === undefined || group === 3) {
    if (
      result.budget.length !== 7 ||
      new Set(result.budget.map((b) => b.category)).size !== 7
    )
      throw new Error("预算必须覆盖七类支出");
  } else if (result.budget.length) throw new Error("本组不应返回预算");
  if (result.budget.some((b) => b.minMinor > b.maxMinor))
    throw new Error("预算区间不正确");
  return result;
}
