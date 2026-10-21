import { expect, it, vi } from "vitest";
import { generateHandbookWithProvider } from "./handbook";
import { mockPlan } from "../src/services/planner";
import {
  handbookGroups,
  validateHandbook,
} from "../src/domain/handbook-schema";
const input = {
  destination: "杭州",
  days: 3,
  travelers: 2,
  budgetMinor: 500000,
  pace: "relaxed" as const,
  interests: ["人文历史"],
  detailedGuide: true,
};
const route = mockPlan(input);
const group = (index: number) => ({
  sections: route.handbook!.sections.filter((s) =>
    (handbookGroups[index].keys as readonly string[]).includes(s.key),
  ),
  budget: index === 3 ? route.handbook!.budget : [],
});
it("分组生成使用严格结构，传入偏好、全程预算和原路线", async () => {
  const fetcher = vi.fn(async (_url, init) => {
    const body = JSON.parse(init!.body as string);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.messages[1].content).toContain("杭州");
    expect(body.messages[1].content).not.toContain("private-key");
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(group(0)) } }],
      }),
    );
  }) as typeof fetch;
  expect(
    await generateHandbookWithProvider(input, 0, route, "private-key", {
      fetcher,
    }),
  ).toEqual(group(0));
});
it("章节列数、预算七类和检查节点必须完整", () => {
  const all = structuredClone(route.handbook!);
  expect(() => validateHandbook(all)).not.toThrow();
  all.sections[1].rows[0].pop();
  expect(() => validateHandbook(all)).toThrow("列数");
  const bad = structuredClone(route.handbook!);
  bad.sections.find((s) => s.key === "checkpoints")!.rows = bad.sections
    .find((s) => s.key === "checkpoints")!
    .rows.filter((r) => r[0] !== "出发前7天");
  expect(() => validateHandbook(bad)).toThrow("7天");
});
it("错误章节不会通过；预算上限超过整程总预算会修正一次后报错", async () => {
  const bad = group(3);
  bad.budget[0].maxMinor = input.budgetMinor + 1;
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(bad) } }],
        }),
      ),
  ) as typeof fetch;
  await expect(
    generateHandbookWithProvider(input, 3, route, "private-key", { fetcher }),
  ).rejects.toMatchObject({ code: "MODEL_OUTPUT_FORMAT" });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("额度不足和输出截断不自动进行收费重试", async () => {
  const quota = vi.fn(
    async () =>
      new Response(JSON.stringify({ error: { code: "insufficient_quota" } }), {
        status: 429,
      }),
  ) as typeof fetch;
  await expect(
    generateHandbookWithProvider(input, 0, route, "private-key", {
      fetcher: quota,
    }),
  ).rejects.toMatchObject({ code: "MODEL_QUOTA" });
  expect(quota).toHaveBeenCalledTimes(1);
  const length = vi.fn(
    async () =>
      new Response(JSON.stringify({ choices: [{ finish_reason: "length" }] })),
  ) as typeof fetch;
  await expect(
    generateHandbookWithProvider(input, 0, route, "private-key", {
      fetcher: length,
    }),
  ).rejects.toMatchObject({ code: "MODEL_OUTPUT_LIMIT" });
  expect(length).toHaveBeenCalledTimes(1);
});
