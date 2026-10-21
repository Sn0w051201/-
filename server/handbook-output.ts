import { z } from "zod";
import {
  budgetLineSchema,
  handbookDefinitions,
  handbookGroups,
} from "../src/domain/handbook-schema";
/** Fixed row fields enforce column count in Structured Outputs instead of asking the model to count cells. */
export function handbookWireSchema(group: number) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const key of handbookGroups[group].keys) {
    const fields: Record<string, z.ZodTypeAny> = Object.fromEntries(
      handbookDefinitions[key].columns.map((label, i) => [
        `c${i + 1}`,
        z.string().min(1).max(300).describe(label),
      ]),
    );
    if (key === "checkpoints")
      fields.c1 = z.enum(["出发前7天", "出发前3天", "出发前1天"]);
    if (key === "emergency")
      fields.c1 = z.enum([
        "下雨",
        "排队太久",
        "临时闭馆",
        "交通延误",
        "体力不支",
        "订不到票",
        "预算超支",
      ]);
    shape[key] = z
      .array(z.object(fields).strict())
      .min(2)
      .max(key === "stays" ? 3 : 12);
  }
  if (group === 3) shape.budget = z.array(budgetLineSchema).length(7);
  return z.object(shape).strict();
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function cell(value: unknown): unknown {
  if (typeof value !== "string") return value;
  // The generator has no verified contact/URL source. Redact those claims without discarding valid travel advice.
  return value
    .trim()
    .replace(
      /出发前\s*([七三一])\s*天/g,
      (_, n: string) =>
        `出发前${({ 七: 7, 三: 3, 一: 1 } as Record<string, number>)[n]}天`,
    )
    .replace(/https?:\/\/[^\s，；、。)）\]]+/gi, "【网址需出发前核实】")
    .replace(
      /((?:电话|热线|报警号码|急救号码)[：:\s]*)\+?\d[\d\s/、-]{1,25}\d/g,
      "$1【号码需出发前核实】",
    );
}
export function normalizeHandbookOutput(raw: unknown, group: number): unknown {
  if (!record(raw)) return raw;
  const legacy = Array.isArray(raw.sections);
  const sections = legacy
    ? (raw.sections as unknown[])
    : handbookGroups[group].keys
        .filter((k) => Object.hasOwn(raw, k))
        .map((key) => ({ key, rows: raw[key] }));
  return {
    sections: sections.map((s) => {
      if (
        !record(s) ||
        typeof s.key !== "string" ||
        !Object.hasOwn(handbookDefinitions, s.key) ||
        !Array.isArray(s.rows)
      )
        return s;
      const columns =
        handbookDefinitions[s.key as keyof typeof handbookDefinitions].columns;
      let rows = s.rows.map((row) => {
        if (Array.isArray(row)) return row.map(cell);
        if (!record(row)) return row;
        const keys = columns.map((_, i) => `c${i + 1}`);
        const names = keys.every((k) => Object.hasOwn(row, k)) ? keys : columns;
        if (
          Object.keys(row).length !== columns.length ||
          !names.every((k) => Object.hasOwn(row, k))
        )
          return row;
        return names.map((k) => cell(row[k]));
      });
      if (
        Array.isArray(rows[0]) &&
        rows[0].length === columns.length &&
        rows[0].every((c: unknown, i: number) => c === columns[i])
      )
        rows = rows.slice(1);
      return { key: s.key, rows };
    }),
    budget: raw.budget === undefined && group !== 3 ? [] : raw.budget,
  };
}
export function handbookIssue(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues
      .slice(0, 3)
      .map((issue) => {
        const part = issue.path
          .map((k) =>
            typeof k === "number"
              ? `第${k + 1}项`
              : (
                  {
                    sections: "章节",
                    rows: "表格行",
                    budget: "预算",
                    minMinor: "最低预算",
                    maxMinor: "最高预算",
                    note: "预算说明",
                    key: "章节标识",
                  } as Record<string, string>
                )[k] || "字段",
          )
          .join("/");
        const problem =
          issue.code === "too_big"
            ? `超过上限${issue.maximum}`
            : issue.code === "too_small"
              ? `不足下限${issue.minimum}`
              : issue.code === "invalid_type"
                ? "缺失或类型不正确"
                : "不符合约定";
        return `${part}：${problem}`;
      })
      .join("；");
  }
  const known = [
    "旅行手册章节不完整",
    "旅行手册表格列数不正确",
    "请对比2—3个住宿区域",
    "缺少出发前7天/3天/1天检查",
    "应急场景不完整",
    "预算必须覆盖七类支出",
    "本组不应返回预算",
    "预算区间不正确",
    "预算七类上限合计超过总预算",
  ];
  return error instanceof Error && known.includes(error.message)
    ? error.message
    : "未返回有效JSON或章节结构";
}
