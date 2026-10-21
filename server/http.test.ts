import { createServer } from "node:http";
import { afterEach, it, expect, vi } from "vitest";
import { aiHandler } from "./http";
import { mockPlan } from "../src/services/planner";
const servers: ReturnType<typeof createServer>[] = [];
const nativeFetch = globalThis.fetch;
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((r) => {
          s.closeAllConnections();
          s.close(() => r());
        }),
    ),
  );
});
async function server() {
  const s = createServer(async (req, res) => {
    await aiHandler(req, res);
  });
  servers.push(s);
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(s.address() as { port: number }).port}`;
}
const input = {
  destination: "成都",
  days: 1,
  budgetMinor: 200000,
  travelers: 2,
  pace: "relaxed",
  interests: ["当地美食"],
};
it("代理只向允许的模型服务发送密钥，响应不含密钥并传递追问上下文", async () => {
  const plan = mockPlan(input as never);
  const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const messages = JSON.parse(String(init?.body)).messages;
    expect(messages[1].content).toContain("室内");
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(plan) } }],
      }),
    );
  });
  vi.stubGlobal("fetch", fetcher);
  const base = await server();
  const response = await nativeFetch(base + "/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "deepseek",
      key: "test-private-key",
      input: {
        ...input,
        adjustment: "改成室内",
        previousPlan: JSON.stringify(plan),
      },
    }),
  });
  expect(response.status).toBe(200);
  const text = await response.text();
  expect(text).not.toContain("test-private-key");
  expect(JSON.parse(text).days).toHaveLength(1);
  expect(fetcher.mock.calls[0][0]).toBe(
    "https://api.deepseek.com/chat/completions",
  );
});
it("生产环境服务器密钥需要令牌，跨来源与非法服务拒绝", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("LLM_API_KEY", "server-secret");
  const base = await server();
  let res = await nativeFetch(base + "/api/ai", {
    method: "POST",
    body: JSON.stringify({ provider: "openai", input }),
  });
  expect(res.status).toBe(401);
  res = await nativeFetch(base + "/api/ai", {
    method: "POST",
    headers: { Origin: "https://attacker.example" },
    body: "{}",
  });
  expect(res.status).toBe(403);
  res = await nativeFetch(base + "/api/ai", {
    method: "POST",
    body: JSON.stringify({
      provider: "https://attacker.example",
      key: "x",
      input,
    }),
  });
  expect(res.status).toBe(400);
});
it("上游失败返回可读错误，不泄露模型响应、密钥或无效行程", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("private upstream debug", { status: 500 })),
  );
  const base = await server();
  const res = await nativeFetch(base + "/api/ai", {
    method: "POST",
    body: JSON.stringify({
      provider: "openai",
      key: "test-private-key",
      input,
    }),
  });
  expect(res.status).toBe(400);
  expect(await res.text()).not.toMatch(/private|test-private-key|"days"/);
});
it("已有服务未设置跨域变量时，允许项目网页预检及健康检查，拒绝无关来源", async () => {
  vi.stubEnv("ALLOWED_ORIGIN", "");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("LLM_API_KEY", "server-secret");
  const base = await server();
  const origin = "https://sn0w051201.github.io";
  const preflight = await nativeFetch(base + "/api/ai", {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,authorization",
    },
  });
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get("access-control-allow-origin")).toBe(origin);
  expect(preflight.headers.get("access-control-allow-headers")).toContain(
    "Authorization",
  );
  const health = await nativeFetch(base + "/api/health", {
    headers: { Origin: origin },
  });
  expect(health.status).toBe(200);
  expect((await health.json()).version).toBe(2);
  const denied = await nativeFetch(base + "/api/ai", {
    method: "OPTIONS",
    headers: { Origin: "https://attacker.example" },
  });
  expect(denied.status).toBe(403);
  expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  const auth = await nativeFetch(base + "/api/ai", {
    method: "POST",
    headers: { Origin: origin },
    body: JSON.stringify({ provider: "openai", input }),
  });
  expect(auth.status).toBe(401);
  expect(auth.headers.get("access-control-allow-origin")).toBe(origin);
});
it("显式来源覆盖默认来源，并支持 Render 可信环境提供的同源网址", async () => {
  vi.stubEnv("ALLOWED_ORIGIN", "https://private.example");
  vi.stubEnv("RENDER_EXTERNAL_URL", "https://sn0w.onrender.com");
  const base = await server();
  for (const origin of [
    "https://private.example",
    "https://sn0w.onrender.com",
    base,
  ]) {
    const r = await nativeFetch(base + "/api/health", {
      headers: { Origin: origin },
    });
    expect(r.status).toBe(200);
    expect(r.headers.get("access-control-allow-origin")).toBe(origin);
  }
  const blocked = await nativeFetch(base + "/api/health", {
    headers: { Origin: "https://sn0w051201.github.io" },
  });
  expect(blocked.status).toBe(403);
});
