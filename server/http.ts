import type { IncomingMessage, ServerResponse } from "node:http";
import { generateWithProvider } from "./llm";
const providers = {
  openai: ["https://api.openai.com/v1", "gpt-4o-mini"],
  deepseek: ["https://api.deepseek.com", "deepseek-chat"],
  qwen: ["https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-plus"],
} as const;
const limits = new Map<string, { at: number; count: number }>();
export async function aiHandler(req: IncomingMessage, res: ServerResponse) {
  if (!req.url?.startsWith("/api/")) return false;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const origin = req.headers.origin;
  const allowed = process.env.ALLOWED_ORIGIN;
  if (
    origin &&
    origin !==
      (allowed ||
        `${"encrypted" in req.socket && req.socket.encrypted ? "https" : "http"}://${req.headers.host}`)
  ) {
    res.writeHead(403);
    res.end(JSON.stringify({ error: "来源不在允许范围" }));
    return true;
  }
  if (origin && allowed) {
    res.setHeader("Access-Control-Allow-Origin", allowed);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }
  if (req.url === "/api/health") {
    res.end(JSON.stringify({ ok: true }));
    return true;
  }
  if (req.url !== "/api/ai" || req.method !== "POST") {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "接口不存在" }));
    return true;
  }
  const ip = req.socket.remoteAddress || "local";
  const now = Date.now();
  let rate = limits.get(ip);
  if (!rate || now - rate.at > 60000) {
    rate = { at: now, count: 0 };
    limits.set(ip, rate);
  }
  if (++rate.count > 12) {
    res.writeHead(429);
    res.end(JSON.stringify({ error: "请求较频繁，请稍后重试" }));
    return true;
  }
  if (limits.size > 10000)
    for (const [k, v] of limits) if (now - v.at > 60000) limits.delete(k);
  try {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > 180000) throw new Error("请求内容过大");
    }
    const data = JSON.parse(body);
    const provider = providers[data.provider as keyof typeof providers];
    if (!Object.hasOwn(providers, data.provider) || !provider)
      throw new Error("请选择支持的模型服务");
    if (
      data.model !== undefined &&
      (typeof data.model !== "string" || data.model.length > 100)
    )
      throw new Error("模型名称不合法");
    const supplied = typeof data.key === "string" ? data.key : "";
    if (supplied.length > 1000) throw new Error("密钥格式不合法");
    if (
      !supplied &&
      process.env.NODE_ENV === "production" &&
      (!process.env.PROXY_ACCESS_TOKEN ||
        req.headers.authorization !==
          `Bearer ${process.env.PROXY_ACCESS_TOKEN}`)
    ) {
      res.writeHead(401);
      res.end(
        JSON.stringify({ error: "此服务需要自己的模型密钥或代理访问令牌" }),
      );
      return true;
    }
    const plan = await generateWithProvider(
      data.input,
      supplied || process.env.LLM_API_KEY || "",
      { baseUrl: provider[0], model: data.model || provider[1] },
    );
    res.end(JSON.stringify(plan));
  } catch (e) {
    res.writeHead(400);
    res.end(
      JSON.stringify({
        error:
          e instanceof SyntaxError
            ? "请求格式不正确"
            : (e as Error).message.includes("密钥")
              ? "尚未配置有效模型密钥"
              : "生成失败，请检查模型配置或缩短天数后重试；未保存无效行程。",
      }),
    );
  }
  return true;
}
