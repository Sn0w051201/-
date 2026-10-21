import type { GeneratedPlan, PlanInput } from "../domain/types";
import { handbookDefinitions } from "../domain/handbook-schema";
import type { HandbookKey } from "../domain/handbook-schema";
import { money } from "../domain/money";
import { downloadBlob } from "../services/sharing";
import { Button } from "./UI";
import { slotLabels } from "./Recommendation";

export function GuideTable({
  columns,
  rows,
}: {
  columns: readonly string[];
  rows: string[][];
}) {
  return (
    <div
      className="guide-table-scroll"
      role="region"
      aria-label={columns.join("、")}
      tabIndex={0}
    >
      <table className="guide-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function dailyRows(day: GeneratedPlan["days"][number]) {
  return day.items.map((a) => [
    `${a.time} · ${a.slot ? slotLabels[a.slot] : "活动"}`,
    `${a.execution?.priority || "待确认"} · ${a.name}\n${a.address}`,
    a.details?.reason || a.note || "待补充",
    a.details?.transport || "【需出发前核实】",
    `${a.duration}分钟`,
    a.details?.reservation || "【需出发前核实】",
    a.execution?.openingHours || "【需出发前核实】",
    a.execution?.effort || "待评估",
    a.execution?.audience || "请按同行人体力核实",
    a.execution
      ? `全员估算 ¥${money(a.execution.minMinor)}—${money(a.execution.maxMinor)}`
      : `全员估算 ¥${money(a.costMinor)}`,
    a.details?.alternatives.join("；") || "请出发前确定附近备选",
  ]);
}
const dailyColumns = [
  "时间段",
  "地点 / 活动 / 优先级",
  "为什么去",
  "交通方式及耗时",
  "停留时长",
  "预约要求",
  "营业 / 闭馆",
  "体力",
  "适合人群",
  "费用区间",
  "备选方案",
];
export function DailyGuide({ day }: { day: GeneratedPlan["days"][number] }) {
  return (
    <div className="daily-guide">
      <GuideTable columns={dailyColumns} rows={dailyRows(day)} />
      {day.practical && (
        <div className="daily-contingency">
          <p>
            <strong>机动留白 · {day.practical.bufferMinutes}分钟</strong>{" "}
            {day.practical.bufferPlan}
          </p>
          <dl>
            {(
              [
                ["rain", "下雨"],
                ["queue", "排队太久"],
                ["closure", "临时闭馆"],
                ["tired", "太累了"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{day.practical![key]}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
export function handbookMarkdown(plan: GeneratedPlan, travelers: number) {
  const table = (columns: readonly string[], rows: string[][]) =>
    [columns, columns.map(() => "---"), ...rows]
      .map(
        (r) =>
          `| ${r.map((s) => s.replaceAll("|", "／").replaceAll("\n", "；")).join(" | ")} |`,
      )
      .join("\n");
  let output = `# ${plan.title}\n\n一、攻略概览\n\n${plan.summary}\n\n假设与核验提醒\n${plan.assumptions.map((a) => `- ${a}`).join("\n")}\n\n`;
  for (const key of [
    "basics",
    "days",
    "transport",
    "stays",
    "food",
    "budget",
    "sights",
    "safety",
    "tools",
    "emergency",
    "checkpoints",
  ]) {
    if (key === "days") {
      output +=
        `## 三、每日行程\n\n` +
        plan.days
          .map(
            (d, i) =>
              `### 第${i + 1}天 · ${d.theme}\n\n${table(dailyColumns, dailyRows(d))}\n\n${
                d.practical
                  ? Object.entries(d.practical)
                      .map(
                        ([k, v]) =>
                          `${({ bufferMinutes: "机动分钟", bufferPlan: "机动安排", rain: "下雨", queue: "排队", closure: "闭馆", tired: "体力不足" } as Record<string, string>)[k]}：${v}`,
                      )
                      .join("\n\n")
                  : ""
              }`,
          )
          .join("\n\n") +
        "\n\n";
      continue;
    }
    if (key === "budget") {
      if (plan.handbook)
        output += `## 七、预算清单\n\n${table(["类别", "全员预算（估算）", "人均预算（估算）", "取舍与支付"], budgetRows(plan, travelers))}\n\n`;
      continue;
    }
    const section = plan.handbook?.sections.find((s) => s.key === key);
    if (section) {
      const def = handbookDefinitions[section.key];
      output += `## ${def.title}\n\n${table(def.columns, section.rows)}\n\n`;
    }
  }
  return output;
}
function budgetRows(plan: GeneratedPlan, travelers: number) {
  const lines = plan.handbook?.budget || [];
  const rows = lines.map((b) => [
    b.category,
    `¥${money(b.minMinor)}—${money(b.maxMinor)}`,
    `¥${money(Math.floor(b.minMinor / travelers))}—${money(Math.ceil(b.maxMinor / travelers))}`,
    b.note,
  ]);
  rows.push([
    "合计",
    `¥${money(lines.reduce((n, b) => n + b.minMinor, 0))}—${money(lines.reduce((n, b) => n + b.maxMinor, 0))}`,
    `¥${money(Math.floor(lines.reduce((n, b) => n + b.minMinor, 0) / travelers))}—${money(Math.ceil(lines.reduce((n, b) => n + b.maxMinor, 0) / travelers))}`,
    "估算而非实际支出；七类合计包含弹性预算，请勿重复相加。",
  ]);
  return rows;
}
export default function TravelHandbook({
  plan,
  input,
  saved = false,
}: {
  plan: GeneratedPlan;
  input?: Pick<PlanInput, "travelers" | "travelProfile">;
  saved?: boolean;
}) {
  const travelers = Math.max(1, input?.travelers || 1);
  if (!plan.handbook) return null;
  const render = (key: HandbookKey) => {
    const section = plan.handbook!.sections.find((s) => s.key === key);
    if (!section) return null;
    return (
      <details
        key={key}
        className="handbook-section"
        open={key === "basics" || undefined}
      >
        <summary>{handbookDefinitions[key].title}</summary>
        <GuideTable
          columns={handbookDefinitions[key].columns}
          rows={section.rows}
        />
      </details>
    );
  };
  return (
    <section className={`travel-handbook ${saved ? "panel p-5 mb-5" : ""}`}>
      <div className="flex flex-wrap justify-between gap-3 items-center">
        <h2>可执行旅行手册</h2>
        <Button
          variant="secondary"
          onClick={() =>
            downloadBlob(
              new Blob([handbookMarkdown(plan, travelers)], {
                type: "text/markdown;charset=utf-8",
              }),
              `${plan.title.replace(/[\\/:*?"<>|]/g, "_")}-旅行手册.md`,
            )
          }
        >
          下载完整攻略
        </Button>
      </div>
      <p className="form-note">
        表格可横向滑动。费用为估算；未联网核验的信息，请出发前在官方渠道确认。
      </p>
      {saved && (
        <>
          <h3>一、攻略概览</h3>
          <p>{plan.summary}</p>
          <ul>
            {plan.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </>
      )}
      {input?.travelProfile && (
        <details className="handbook-section">
          <summary>本次旅行条件 · 你提供的信息</summary>
          <GuideTable
            columns={["条件", "内容"]}
            rows={[
              ["同行人数", `${travelers}人`],
              ["住宿夜数", `${input.travelProfile.nights}晚`],
              ...(
                [
                  ["departure", "出发地"],
                  ["season", "季节"],
                  ["arrivalDeparture", "抵达与返程"],
                  ["companions", "同行与体力"],
                  ["accommodation", "住宿偏好"],
                  ["transport", "交通偏好"],
                  ["diet", "饮食禁忌"],
                  ["mustDo", "必去必吃"],
                  ["avoid", "避雷"],
                  ["budgetIncludes", "预算覆盖"],
                  ["other", "其他要求"],
                ] as const
              ).map(([key, label]) => [
                label,
                input.travelProfile![key] || "未提供，需确认",
              ]),
            ]}
          />
        </details>
      )}
      {render("basics")}
      <details className="handbook-section">
        <summary>三、每日行程表 · {plan.days.length}天</summary>
        {plan.days.map((day, i) => (
          <section key={i}>
            <h3>
              第{i + 1}天 · {day.theme}
            </h3>
            <DailyGuide day={day} />
          </section>
        ))}
      </details>
      {(["transport", "stays", "food"] as const).map(render)}
      <details className="handbook-section">
        <summary>七、预算清单</summary>
        <GuideTable
          columns={[
            "类别",
            "全员预算（估算）",
            "人均预算（估算）",
            "取舍与支付",
          ]}
          rows={budgetRows(plan, travelers)}
        />
      </details>
      {(["sights", "safety", "tools", "emergency", "checkpoints"] as const).map(
        render,
      )}
    </section>
  );
}
