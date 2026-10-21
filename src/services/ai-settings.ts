export interface AISettings {
  provider: "openai" | "deepseek" | "qwen";
  model: string;
  proxyUrl: string;
  key: string;
  remember: boolean;
  token: string;
}
const settingKey = "moodnomad-ai-settings";
const secretKey = "moodnomad-ai-secret";
export function getAISettings(): AISettings {
  let value = {};
  let key = "",
    token = "";
  try {
    value = JSON.parse(localStorage.getItem(settingKey) || "{}");
    key =
      sessionStorage.getItem(secretKey) ||
      localStorage.getItem(secretKey) ||
      "";
    token =
      sessionStorage.getItem(secretKey + "-token") ||
      localStorage.getItem(secretKey + "-token") ||
      "";
  } catch {}
  return {
    provider: "openai",
    model: "gpt-4o-mini",
    proxyUrl: import.meta.env.DEV ? "/api/ai" : "",
    remember: false,
    ...value,
    key,
    token,
  };
}
export function saveAISettings(s: AISettings) {
  const { key, token, ...publicConfig } = s;
  localStorage.setItem(settingKey, JSON.stringify(publicConfig));
  localStorage.removeItem(secretKey);
  sessionStorage.removeItem(secretKey);
  localStorage.removeItem(secretKey + "-token");
  sessionStorage.removeItem(secretKey + "-token");
  if (token)
    (s.remember ? localStorage : sessionStorage).setItem(
      secretKey + "-token",
      token,
    );
  if (key) (s.remember ? localStorage : sessionStorage).setItem(secretKey, key);
}
export function proxyURL(value: string) {
  if (!value) throw new Error("请先在偏好与数据中配置 AI 后端代理地址");
  const url = new URL(value, location.origin);
  if (url.username || url.password || url.search || url.hash)
    throw new Error("代理地址不能包含凭据或查询参数");
  if (
    url.protocol !== "https:" &&
    !(import.meta.env.DEV && url.origin === location.origin)
  )
    throw new Error("AI 代理必须使用 HTTPS");
  return url.href;
}
