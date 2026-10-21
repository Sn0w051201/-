import { memo, useState } from "react";
import {
  completePlaceAddress,
  placeCopyText,
  placeNavigationURL,
} from "../domain/local-advice";
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
function Recommendation({
  item,
  expanded = false,
}: {
  item: Pick<
    Activity,
    "name" | "address" | "place" | "slot" | "details" | "execution"
  >;
  expanded?: boolean;
}) {
  const [copyNotice, setCopyNotice] = useState("");
  const [fallbackText, setFallbackText] = useState("");
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
  const copyAddress = async () => {
    const text = placeCopyText(
      item.place?.name || item.name,
      item.place?.fullAddress || "",
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopyNotice(
        item.place && completePlaceAddress(item.place.fullAddress)
          ? "地址已复制（含店名）"
          : "店名已复制，请搜索并核实地址",
      );
      setFallbackText("");
    } catch {
      setCopyNotice("复制未成功，请选择下面文字手动复制。");
      setFallbackText(text);
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
      {d.localAdvice && (
        <section className="local-advice">
          <div className="local-advice-tags">
            <span>选店 / 体验方向</span>
            {d.localAdvice.styles.map((t) => (
              <em key={t}>{t}</em>
            ))}
          </div>
          <p>
            <strong>必点 / 必体验：</strong>
            {d.localAdvice.mustTry.join("；")}
          </p>
          <p>
            <strong>怎么吃 / 怎么玩：</strong>
            {d.localAdvice.playTips.join("；")}
          </p>
          <div className="local-advice-address">
            <strong>{item.place?.name || "门店 / 场所选择"}</strong>
            <p>
              {item.place && completePlaceAddress(item.place.fullAddress)
                ? item.place.fullAddress
                : "暂无已核实的完整店址，可复制地点名称搜索【需核实】"}
            </p>
            {item.place && (
              <small>
                用户提供 · {item.place.source} · 查阅 {item.place.observedAt} ·
                未联网核实
                <br />
                {item.place.sourceNote}
              </small>
            )}
            <div className="local-advice-actions">
              <button type="button" onClick={() => void copyAddress()}>
                <Copy size={13} />
                {item.place && completePlaceAddress(item.place.fullAddress)
                  ? "复制地址"
                  : "复制地点搜索"}
              </button>
              <a
                href={placeNavigationURL(
                  item.place?.name || item.name,
                  item.place?.fullAddress || item.address,
                )}
                target="_blank"
                rel="noreferrer"
              >
                地图搜索 / 导航 ↗
              </a>
              {item.place?.sourceUrl && (
                <a href={item.place.sourceUrl} target="_blank" rel="noreferrer">
                  {item.place.source === "大众点评"
                    ? "去点评核实 ↗"
                    : "核实资料来源 ↗"}
                </a>
              )}
            </div>
            {copyNotice && <p role="status">{copyNotice}</p>}
            {fallbackText && (
              <textarea
                aria-label="手动复制店名地址"
                readOnly
                value={fallbackText}
                onFocus={(e) => e.target.select()}
              />
            )}
          </div>
        </section>
      )}
      <details className="recommendation-more" open={expanded || undefined}>
        <summary>
          交通、预约、备选与口碑核验 <ArrowUpRight size={13} />
        </summary>
        <dl>
          {d.localAdvice && (
            <>
              <div>
                <dt>营业与时段</dt>
                <dd>{d.localAdvice.hoursTip}</dd>
              </div>
              <div>
                <dt>排队与取舍</dt>
                <dd>{d.localAdvice.queueTip}</dd>
              </div>
              <div>
                <dt>预约方式</dt>
                <dd>{d.localAdvice.reservationTip}</dd>
              </div>
              <div>
                <dt>适合谁</dt>
                <dd>{d.localAdvice.suitableFor}</dd>
              </div>
              <div>
                <dt>避雷提醒</dt>
                <dd>{d.localAdvice.avoidTips.join("；")}</dd>
              </div>
            </>
          )}
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

export default memo(Recommendation);
