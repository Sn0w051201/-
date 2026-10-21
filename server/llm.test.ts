import { expect, it, vi } from "vitest";
import { generateWithProvider } from "./llm";
import { mockPlan } from "../src/services/planner";
const input = {
  destination: "大理",
  days: 2,
  travelers: 4,
  budgetMinor: 800000,
  pace: "relaxed" as const,
  interests: [],
};
it("模型仅由服务端带密钥调用，校验成功后返回", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(mockPlan(input)) } }],
        }),
      ),
  ) as unknown as typeof fetch;
  const plan = await generateWithProvider(input, "test-key", { fetcher });
  expect(plan.days).toHaveLength(2);
  expect(vi.mocked(fetcher).mock.calls[0][0]).toBe(
    "https://api.openai.com/v1/chat/completions",
  );
  expect(vi.mocked(fetcher).mock.calls[0][1]?.headers).toMatchObject({
    Authorization: "Bearer test-key",
  });
});
it("无效输出只重试一次且不返回畸形数据", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: '{"days":[]}' } }] }),
      ),
  ) as unknown as typeof fetch;
  await expect(
    generateWithProvider(input, "test-key", { fetcher }),
  ).rejects.toThrow("未保存无效行程");
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("天数不匹配会拒绝，不泄露上游错误或密钥", async () => {
  const plan = mockPlan({ ...input, days: 1 });
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(plan) } }],
        }),
      ),
  ) as unknown as typeof fetch;
  await expect(
    generateWithProvider(input, "secret", { fetcher }),
  ).rejects.toThrow("暂时未能生成");
});
it("缺少密钥和非 HTTPS 地址时不发送请求", async () => {
  const fetcher = vi.fn() as unknown as typeof fetch;
  await expect(generateWithProvider(input, "", { fetcher })).rejects.toThrow(
    "密钥",
  );
  await expect(
    generateWithProvider(input, "secret", {
      fetcher,
      baseUrl: "http://bad.example",
    }),
  ).rejects.toThrow("HTTPS");
  expect(fetcher).not.toHaveBeenCalled();
});
it("拒绝只有景点的简略输出，最多重试一次", async () => {
  const plan = mockPlan(input);
  plan.days[0].items = plan.days[0].items.filter((a) => a.slot !== "dinner");
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(plan) } }],
        }),
      ),
  ) as unknown as typeof fetch;
  await expect(
    generateWithProvider(input, "secret", { fetcher }),
  ).rejects.toThrow("未保存无效行程");
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("拒绝无依据的点评评分或榜单名次", async () => {
  const plan = mockPlan(input);
  plan.days[0].items[0].details!.reason = "大众点评评分 4.9，这家排名 1";
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(plan) } }],
        }),
      ),
  ) as unknown as typeof fetch;
  await expect(
    generateWithProvider(input, "secret", { fetcher }),
  ).rejects.toThrow("未保存无效行程");
});
it("OpenAI 密钥拒绝不重试，错误中不回传上游内容或密钥", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          error: { message: "private secret-key", code: "invalid_api_key" },
        }),
        { status: 401 },
      ),
  ) as unknown as typeof fetch;
  await expect(
    generateWithProvider(input, "secret-key", { fetcher }),
  ).rejects.toMatchObject({
    code: "KEY_INVALID",
    status: 401,
    message: expect.stringContaining("401"),
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("OpenAI 429 余额不足与频率限制分别提示，均不盲目重试", async () => {
  const quota = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "insufficient_quota",
            message: "private upstream debug",
          },
        }),
        { status: 429 },
      ),
  ) as unknown as typeof fetch;
  await expect(
    generateWithProvider(input, "secret", { fetcher: quota }),
  ).rejects.toMatchObject({ code: "MODEL_QUOTA", status: 402 });
  expect(quota).toHaveBeenCalledTimes(1);
  const rate = vi.fn(
    async () => new Response("{}", { status: 429 }),
  ) as unknown as typeof fetch;
  await expect(
    generateWithProvider(input, "secret", { fetcher: rate }),
  ).rejects.toMatchObject({ code: "MODEL_RATE_LIMIT" });
  expect(rate).toHaveBeenCalledTimes(1);
});
it("不存在的模型、权限和请求参数分别诊断", async () => {
  for (const [status, code] of [
    [404, "MODEL_NOT_FOUND"],
    [403, "MODEL_FORBIDDEN"],
    [400, "MODEL_PARAMETERS"],
  ] as const) {
    const fetcher = vi.fn(
      async () => new Response("{}", { status }),
    ) as unknown as typeof fetch;
    await expect(
      generateWithProvider(input, "secret", { fetcher }),
    ).rejects.toMatchObject({ code });
    expect(fetcher).toHaveBeenCalledTimes(1);
  }
});
it("识别长度截断，不重复发送同一超长请求；DeepSeek 不超过8192输出额度", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [
            { finish_reason: "length", message: { content: '{"days":[' } },
          ],
        }),
      ),
  ) as unknown as typeof fetch;
  await expect(
    generateWithProvider({ ...input, days: 5 }, "secret", {
      fetcher,
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-chat",
    }),
  ).rejects.toMatchObject({ code: "MODEL_OUTPUT_LIMIT" });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(
    JSON.parse(String(vi.mocked(fetcher).mock.calls[0][1]?.body)).max_tokens,
  ).toBe(8192);
});
it("完整 Markdown JSON 可以通过严格校验，超时不重复调用", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  "```json\n" + JSON.stringify(mockPlan(input)) + "\n```",
              },
            },
          ],
        }),
      ),
  ) as unknown as typeof fetch;
  expect(
    (await generateWithProvider(input, "secret", { fetcher })).days,
  ).toHaveLength(2);
  const timeout = vi.fn(async () => {
    throw new DOMException("private timeout debug", "TimeoutError");
  }) as unknown as typeof fetch;
  await expect(
    generateWithProvider(input, "secret", { fetcher: timeout }),
  ).rejects.toMatchObject({ code: "MODEL_TIMEOUT", status: 504 });
  expect(timeout).toHaveBeenCalledTimes(1);
});
it("格式失败重试携带具体字段限制与上次输出，修复后才返回", async () => {
  const invalid = mockPlan(input);
  invalid.days[0].items[0].details!.reason = "很长的推荐理由".repeat(100);
  const correct: any = mockPlan(input);
  correct.days[0].items[0].lat = null;
  correct.days[0].items[0].lng = null;
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(invalid) } }],
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(correct) } }],
        }),
      ),
    ) as unknown as typeof fetch;
  const plan = await generateWithProvider(input, "private-key", { fetcher });
  expect(plan.days).toHaveLength(2);
  expect(plan.days[0].items[0].lat).toBeUndefined();
  const request = JSON.parse(String(vi.mocked(fetcher).mock.calls[1][1]?.body));
  expect(request.response_format.type).toBe("json_schema");
  expect(
    request.messages.find((m: any) => m.role === "assistant").content,
  ).toBe(JSON.stringify(invalid));
  expect(request.messages.at(-1).content).toContain("推荐理由");
  expect(request.messages.at(-1).content).toContain("250");
});
it("修复失败返回可定位的字段提示，不暴露模型原始文字，调用最多两次", async () => {
  const plan = mockPlan(input);
  plan.days[0].items[0].details!.reason = "private-model-content".repeat(100);
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(plan) } }],
        }),
      ),
  ) as unknown as typeof fetch;
  try {
    await generateWithProvider(input, "private-key", { fetcher });
    throw new Error("Should reject");
  } catch (e) {
    expect((e as Error).message).toContain("推荐理由");
    expect((e as Error).message).not.toContain("private-model-content");
    expect((e as Error).message).not.toContain("private-key");
  }
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("结构化模型明确拒绝时不把空内容当格式错误重复调用", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: null, refusal: "private refusal details" } },
          ],
        }),
      ),
  ) as unknown as typeof fetch;
  await expect(
    generateWithProvider(input, "private-key", { fetcher }),
  ).rejects.toMatchObject({ code: "MODEL_REFUSAL" });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("单日被截断时指导恢复当前日期，不再要求缩短整段旅行", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ finish_reason: "length", message: { content: "{" } }],
        }),
      ),
  ) as unknown as typeof fetch;
  await expect(
    generateWithProvider(
      { ...input, days: 1, totalDays: 5, dayOffset: 2 },
      "test-key",
      { fetcher },
    ),
  ).rejects.toMatchObject({
    code: "MODEL_OUTPUT_LIMIT",
    message: expect.stringContaining("当前日期"),
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
