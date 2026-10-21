import { useState } from "react";
import { getAISettings, saveAISettings } from "../services/ai-settings";
import { Button, Field } from "./UI";
import { useMood } from "../context";
export default function AISettings() {
  const [s, setS] = useState(getAISettings);
  const { notify } = useMood();
  return (
    <section className="panel settings-panel">
      <h2>AI 模型与安全代理</h2>
      <p>
        GitHub Pages 只托管网页。真实 AI 需要你部署后端代理，或在本地运行 npm
        run dev。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            saveAISettings(s);
            notify("AI 配置已保存；密钥不会进入数据备份");
          } catch {
            notify("配置未保存，浏览器存储不可用", "error");
          }
        }}
      >
        <Field label="模型服务">
          <select
            value={s.provider}
            onChange={(e) => {
              const provider = e.target.value as typeof s.provider;
              setS({
                ...s,
                provider,
                model: {
                  openai: "gpt-4o-mini",
                  deepseek: "deepseek-chat",
                  qwen: "qwen-plus",
                }[provider],
              });
            }}
          >
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
            <option value="qwen">通义千问</option>
          </select>
        </Field>
        <Field label="模型名称">
          <input
            value={s.model}
            maxLength={100}
            onChange={(e) => setS({ ...s, model: e.target.value })}
          />
        </Field>
        <Field label="后端代理地址">
          <input
            value={s.proxyUrl}
            placeholder="https://你的服务/api/ai"
            onChange={(e) => setS({ ...s, proxyUrl: e.target.value })}
          />
          <small>密钥仅发送到该地址，请只使用自己信任的服务。</small>
        </Field>
        <Field label="模型 API Key">
          <input
            type="password"
            autoComplete="off"
            value={s.key}
            onChange={(e) => setS({ ...s, key: e.target.value })}
          />
        </Field>
        <Field label="代理访问令牌（选填）">
          <input
            type="password"
            value={s.token}
            onChange={(e) => setS({ ...s, token: e.target.value })}
          />
        </Field>
        <label>
          <input
            type="checkbox"
            checked={s.remember}
            onChange={(e) => setS({ ...s, remember: e.target.checked })}
          />{" "}
          在此浏览器记住模型密钥
        </label>
        <p className="form-note">
          本地保存不等于加密。共用设备请勿勾选；默认仅保留当前会话。模型请求可能产生费用。
        </p>
        <div className="flex gap-3">
          <Button type="submit">保存 AI 配置</Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const next = { ...s, key: "", token: "" };
              saveAISettings(next);
              setS(next);
              notify("已清除密钥与令牌");
            }}
          >
            清除密钥
          </Button>
        </div>
      </form>
    </section>
  );
}
