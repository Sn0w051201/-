import { useState } from "react";
import { Heart, MapPin, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMood } from "../context";
import { catalog } from "../data/destinations";
import type { Destination } from "../domain/types";
import { uid } from "../domain/types";
import { destinationSchema } from "../domain/destination-schema";
import { Button, Field, Modal, PageHeading, Empty } from "../components/UI";
import { money, parseMoney } from "../domain/money";
export default function Discover() {
  const { state, updateApp, planFor, notify } = useMood();
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("");
  const [theme, setTheme] = useState("");
  const [season, setSeason] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [detail, setDetail] = useState<Destination | null>(null);
  const [editing, setEditing] = useState<Destination | null | undefined>();
  const [error, setError] = useState("");
  const list = catalog(state).filter(
    (d) =>
      (d.name + d.region + d.highlights.join("")).includes(query) &&
      (!month || d.months.includes(Number(month))) &&
      (!season ||
        d.months.some((m) =>
          (
            ({
              spring: [3, 4, 5],
              summer: [6, 7, 8],
              autumn: [9, 10, 11],
              winter: [12, 1, 2],
            }) as Record<string, number[]>
          )[season].includes(m),
        )) &&
      (!theme || d.themes.includes(theme)) &&
      (!favoriteOnly || state.favorites?.includes(d.id)),
  );
  const favorite = (d: Destination) =>
    updateApp((s) => ({
      ...s,
      favorites: s.favorites?.includes(d.id)
        ? s.favorites.filter((id) => id !== d.id)
        : [...(s.favorites || []), d.id],
    }));
  return (
    <div className="fade-in">
      <PageHeading
        eyebrow="SOMEWHERE WORTH SLOWING DOWN"
        title="世界很大，下一站心动"
        description="省会、直辖市与热门旅游城市灵感库 · 路线与价格为编辑参考，请核验实时信息。"
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setError("");
            }}
          >
            <Plus size={16} />
            添加目的地
          </Button>
        }
      />
      <div className="panel discovery-filters">
        <input
          aria-label="搜索目的地"
          placeholder="城市、地标、省份…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="旅行月份"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        >
          <option value="">所有月份</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1} 月
            </option>
          ))}
        </select>
        <select
          aria-label="旅行季节"
          value={season}
          onChange={(e) => setSeason(e.target.value)}
        >
          <option value="">四季皆可</option>
          <option value="spring">春日</option>
          <option value="summer">夏日</option>
          <option value="autumn">秋日</option>
          <option value="winter">冬日</option>
        </select>
        <select
          aria-label="旅行主题"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        >
          <option value="">所有主题</option>
          {[
            "海岛",
            "雪山",
            "古城",
            "美食",
            "人文历史",
            "自然风光",
            "冰雪",
            "都市",
          ].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <Button
          variant={favoriteOnly ? "primary" : "secondary"}
          onClick={() => setFavoriteOnly(!favoriteOnly)}
        >
          <Heart size={16} />
          我的种草
        </Button>
        <span>{list.length} 个目的地</span>
      </div>
      <div className="destination-grid">
        {list.map((d) => (
          <article className="panel destination-card" key={d.id}>
            <button className="destination-image" onClick={() => setDetail(d)}>
              <img
                loading="lazy"
                src={
                  d.photo.startsWith("images/")
                    ? import.meta.env.BASE_URL + d.photo
                    : d.photo
                }
                alt={`${d.name}旅行灵感风景参考，非景点实拍保证`}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span>真实摄影 · 风景参考</span>
              <strong>
                <MapPin size={15} />
                {d.region} · {d.name}
              </strong>
            </button>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <h2>
                  <button onClick={() => setDetail(d)}>{d.name}</button>
                </h2>
                <button
                  aria-label={`收藏${d.name}`}
                  aria-pressed={!!state.favorites?.includes(d.id)}
                  onClick={() => favorite(d)}
                >
                  <Heart
                    fill={state.favorites?.includes(d.id) ? "#d39179" : "none"}
                    size={20}
                  />
                </button>
              </div>
              <p>{d.tagline}</p>
              <div className="flex flex-wrap gap-2 my-3">
                {d.themes.map((t) => (
                  <span className="pill pill-neutral" key={t}>
                    {t}
                  </span>
                ))}
              </div>
              <small className="block mb-2">
                适合 {d.months.join("、")} 月出发
              </small>
              <small>
                {d.days.join("–")} 天 · 人均参考 ¥{money(d.budgetMinor[0])}起
              </small>
              <div className="flex gap-2 mt-4">
                <Button variant="secondary" onClick={() => setDetail(d)}>
                  旅行指南
                </Button>
                <Button onClick={() => planFor(d.name)}>
                  <Sparkles size={14} />
                  规划
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!list.length && (
        <Empty
          title="还没遇到合适的目的地"
          description="换个月份或主题，或添加自己的心动城市。"
        />
      )}
      {detail && (
        <Modal
          title={`${detail.name} · 旅行手册`}
          onClose={() => setDetail(null)}
        >
          <p>{detail.tagline}</p>
          <h3 className="my-4">值得慢慢看的风景</h3>
          <ul>
            {detail.highlights.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
          <h3 className="my-4">经典路线</h3>
          {detail.routes.map((v) => (
            <p key={v}>{v}</p>
          ))}
          <h3 className="my-4">当地美食</h3>
          <p>{detail.foods.join(" · ")}</p>
          <p>
            建议月份：{detail.months.join("、")} 月 · {detail.days.join("–")} 天
          </p>
          <p>
            人均预算参考：¥{money(detail.budgetMinor[0])}–
            {money(detail.budgetMinor[1])}
          </p>
          <h3 className="my-4">实用贴士</h3>
          <ul>
            {detail.tips.map((v) => (
              <li className="my-2" key={v}>
                {v}
              </li>
            ))}
          </ul>
          <p className="form-note">
            内容为静态编辑资料，非实时榜单。照片为风景参考，可能并非该城市。
            <a href={detail.photoSource} target="_blank" rel="noreferrer">
              照片来源
            </a>
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <Button onClick={() => planFor(detail.name)}>
              从这里开始 AI 规划
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(detail);
                setDetail(null);
                setError("");
              }}
            >
              编辑资料
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const saved = updateApp((s) => ({
                  ...s,
                  hiddenDestinations: [
                    ...(s.hiddenDestinations || []),
                    detail.id,
                  ],
                }));
                if (saved) {
                  setDetail(null);
                  notify("已移出发现，可在偏好中恢复");
                }
              }}
            >
              <Trash2 size={14} />
              移出
            </Button>
          </div>
        </Modal>
      )}
      {editing !== undefined && (
        <Modal
          title={editing ? "编辑目的地" : "添加心动目的地"}
          onClose={() => setEditing(undefined)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                const text = (k: string) => String(f.get(k) || "").trim();
                const d = destinationSchema.parse({
                  ...editing,
                  id: editing?.id || uid(),
                  name: text("name"),
                  region: text("region"),
                  country: text("country"),
                  latitude: Number(f.get("latitude")),
                  longitude: Number(f.get("longitude")),
                  tagline: text("tagline"),
                  highlights: text("highlights").split("、"),
                  foods: text("foods").split("、"),
                  routes: text("routes").split("\n"),
                  tips: text("tips").split("\n"),
                  months: text("months")
                    .split(/[、,，]/)
                    .map(Number),
                  themes: text("themes").split("、"),
                  days: [Number(f.get("minDays")), Number(f.get("maxDays"))],
                  budgetMinor: [
                    parseMoney(String(f.get("minBudget"))),
                    parseMoney(String(f.get("maxBudget"))),
                  ],
                  photo: text("photo"),
                  photoSource: text("photoSource"),
                });
                const saved = updateApp((s) => ({
                  ...s,
                  ...(editing &&
                  catalog(s).some((v) => v.id === d.id) &&
                  !s.customDestinations?.some((v) => v.id === d.id)
                    ? {
                        destinationEdits: [
                          ...(s.destinationEdits || []).filter(
                            (v) => v.id !== d.id,
                          ),
                          d,
                        ],
                      }
                    : {
                        customDestinations: [
                          ...(s.customDestinations || []).filter(
                            (v) => v.id !== d.id,
                          ),
                          d,
                        ],
                      }),
                }));
                if (saved) setEditing(undefined);
              } catch {
                setError(
                  "请检查字段：照片与来源需为 HTTPS，月份1–12，天数与预算范围需有效。",
                );
              }
            }}
          >
            {[
              ["name", "城市", editing?.name],
              ["region", "省份/地区", editing?.region],
              ["country", "国家", editing?.country || "中国"],
              ["tagline", "一句话介绍", editing?.tagline],
              ["latitude", "纬度", editing?.latitude],
              ["longitude", "经度", editing?.longitude],
              [
                "months",
                "适合月份（逗号隔开）",
                editing?.months.join(",") || "3,4,5,9,10",
              ],
              ["minDays", "最少天数", editing?.days[0] || 3],
              ["maxDays", "最多天数", editing?.days[1] || 5],
              [
                "minBudget",
                "最低预算（元）",
                editing ? editing.budgetMinor[0] / 100 : 1000,
              ],
              [
                "maxBudget",
                "最高预算（元）",
                editing ? editing.budgetMinor[1] / 100 : 3000,
              ],
              [
                "themes",
                "主题（顿号隔开）",
                editing?.themes.join("、") || "自然风光",
              ],
              [
                "highlights",
                "亮点（顿号隔开）",
                editing?.highlights.join("、"),
              ],
              ["foods", "美食（顿号隔开）", editing?.foods.join("、")],
              ["routes", "路线（每行一条）", editing?.routes.join("\n")],
              ["tips", "贴士（每行一条）", editing?.tips.join("\n")],
              ["photo", "照片 HTTPS 地址", editing?.photo],
              ["photoSource", "照片来源 HTTPS 地址", editing?.photoSource],
            ].map(([key, label, value]) => (
              <Field label={String(label)} key={key}>
                <input name={String(key)} defaultValue={value} required />
              </Field>
            ))}
            {error && <p role="alert">{error}</p>}
            <Button type="submit">保存目的地</Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
