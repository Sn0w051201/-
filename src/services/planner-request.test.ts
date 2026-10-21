import { afterEach, it, expect, vi } from "vitest";
import { generatePlan } from "./planner";
import { mockPlan } from "./planner";
import { getAISettings, proxyURL } from "./ai-settings";
vi.mock("./ai-settings", () => ({
  getAISettings: vi.fn(() => ({
    provider: "deepseek",
    model: "deepseek-chat",
    proxyUrl: "https://proxy.example/api/ai",
    key: "private-test-key",
    token: "",
  })),
  proxyURL: vi.fn((v: string) => v),
}));
const input = {
  destination: "成都",
  days: 1,
  travelers: 2,
  budgetMinor: 200000,
  pace: "relaxed" as const,
  interests: ["当地美食"],
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("跨域或网络错误不误判为密钥错误，不自动重试收费请求", async () => {
  const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  vi.stubGlobal("fetch", fetcher);
  await expect(generatePlan(input)).rejects.toMatchObject({
    kind: "network",
    message: expect.stringContaining("不能判断 API Key 是否有效"),
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("超时单独提示唤醒 Render，密钥错误单独标记", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")),
  );
  await expect(generatePlan(input)).rejects.toMatchObject({ kind: "timeout" });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "密钥无效" }), { status: 401 }),
    ),
  );
  await expect(generatePlan(input)).rejects.toMatchObject({
    kind: "configuration",
    message: "密钥无效",
  });
});
it("网关 HTML 错误不会泄露响应内容，畸形攻略不会保存", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response("<html>private upstream debug</html>", { status: 502 }),
    ),
  );
  await expect(generatePlan(input)).rejects.toMatchObject({
    kind: "service",
    message: expect.stringContaining("HTTP 502"),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ days: [] }))),
  );
  await expect(generatePlan(input)).rejects.toMatchObject({ kind: "output" });
});
it("成功结果仍符合结构，代理配置错误保留配置入口", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(mockPlan(input)))),
  );
  expect((await generatePlan(input)).days).toHaveLength(1);
  vi.mocked(proxyURL).mockImplementationOnce(() => {
    throw new Error("请配置代理地址");
  });
  await expect(generatePlan(input)).rejects.toMatchObject({
    kind: "configuration",
  });
  expect(getAISettings).toHaveBeenCalled();
});
