import {
  ArrowUpRight,
  Copy,
  ExternalLink,
  Lightbulb,
  Route,
  Utensils,
} from "lucide-react";
import type {
  Activity,
  GuideSlot,
  RecommendationSource,
} from "../domain/types";
export const slotLabels: Record<GuideSlot, string> = {
  breakfast: "早餐",
  morning: "上午游玩",
  lunch: "午餐",
  afternoon: "下午游玩",
  tea: "咖啡 / 茶歇",
  shopping: "逛街",
  dinner: "晚餐",
  evening: "夜间活动",
};
const platforms: Record<
  RecommendationSource["platform"],
  { host: string; home: string }
> = {
  大众点评: { host: "dianping.com", home: "https://www.dianping.com/" },
  大众点评必吃榜: { host: "dianping.com", home: "https://www.dianping.com/" },
  米其林指南: {
    host: "guide.michelin.com",
    home: "https://guide.michelin.com/cn/zh_CN",
  },
  本地特色: { host: "", home: "" },
};
export function sourceSearch(source: RecommendationSource) {
  const host = platforms[source.platform].host;
  return `https://www.bing.com/search?q=${encodeURIComponent(`${host ? "site:" + host + " " : ""}${source.query}`)}`;
}
export function Coverage({ items }: { items: Pick<Activity, "slot">[] }) {
  return (
    <div className="coverage-strip" aria-label="每日吃喝玩乐覆盖">
      {(
        [
          "breakfast",
          "morning",
          "lunch",
          "afternoon",
          "tea",
          "dinner",
          "evening",
        ] as const
      ).map((slot) => (
        <span
          key={slot}
          className={items.some((a) => a.slot === slot) ? "covered" : ""}
        >
          {slotLabels[slot]}
        </span>
      ))}
    </div>
  );
}
export default function Recommendation({
  item,
  expanded = false,
}: {
  item: Pick<Activity, "name" | "slot" | "details" | "execution">;
  expanded?: boolean;
}) {
  const d = item.details;
  if (!d) return null;
  const copy = async (text: string, button: HTMLButtonElement) => {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "已复制";
      setTimeout(() => {
        if (button.isConnected) button.textContent = "复制检索词";
      }, 2000);
    } catch {
      const box = button.parentElement?.querySelector("input");
      box?.focus();
      box?.select();
    }
  };
  return (
    <div className="recommendation">
      <p className="recommendation-reason">
        <Lightbulb size={14} />
        <span>{d.reason}</span>
      </p>
      <ul className="recommendation-highlights">
        {d.highlights.map((h, i) => (
          <li key={i}>{h}</li>
        ))}
      </ul>
      <details className="recommendation-more" open={expanded || undefined}>
        <summary>
          交通、预约、备选与口碑核验 <ArrowUpRight size={13} />
        </summary>
        <dl>
          {item.execution && (
            <>
              <div>
                <dt>优先级 / 体力</dt>
                <dd>
                  {item.execution.priority} · {item.execution.effort}体力 ·{" "}
                  {item.execution.audience}
                </dd>
              </div>
              <div>
                <dt>营业 / 闭馆</dt>
                <dd>{item.execution.openingHours}</dd>
              </div>
            </>
          )}
          <div>
            <dt>怎么衔接</dt>
            <dd>{d.transport}</dd>
          </div>
          <div>
            <dt>出发前确认</dt>
            <dd>{d.reservation}</dd>
          </div>
          <div>
            <dt>替代方案</dt>
            <dd>{d.alternatives.join("；")}</dd>
          </div>
        </dl>
        {d.sources.length > 0 && (
          <div className="recommendation-sources">
            <span className="recommendation-source-title">
              选店 / 榜单核验渠道 · 不代表已上榜
            </span>
            {d.sources.map((source, i) => (
              <div className="recommendation-source" key={i}>
                <div>
                  <strong>{source.platform}</strong>
                  <span>待核验</span>
                  <a
                    href={sourceSearch(source)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {source.platform === "本地特色" ? "检索特色" : "站外检索"}
                    <ExternalLink size={11} />
                  </a>
                  {platforms[source.platform].home && (
                    <a
                      href={platforms[source.platform].home}
                      target="_blank"
                      rel="noreferrer"
                    >
                      平台入口
                      <ArrowUpRight size={11} />
                    </a>
                  )}
                </div>
                <label>
                  <span className="sr-only">{source.platform}检索词</span>
                  <input
                    readOnly
                    value={source.query}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    onClick={(e) => void copy(source.query, e.currentTarget)}
                  >
                    复制检索词
                  </button>
                </label>
              </div>
            ))}
            <p>
              检索通过搜索引擎打开；平台入口可能需要登录。核对榜单年份、分店、近期评价和实际人均，不把榜单当成唯一标准。
            </p>
          </div>
        )}
      </details>
    </div>
  );
}
