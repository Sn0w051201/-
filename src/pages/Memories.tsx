import { useState } from "react";
import { useMood } from "../context";
import { Footprints } from "./ChecklistMap";
import { Button, Field, Modal, PageHeading, Empty } from "../components/UI";
import { catalog } from "../data/destinations";
import world from "../data/world-paths.json";
import { haversine, isVisited } from "../domain/journey";
import { uid } from "../domain/types";
import { downloadBlob } from "../services/sharing";
export default function Memories() {
  const { trip, state, updateTrip, notify, canEdit, cloud, selectTrip } =
    useMood();
  const [tab, setTab] = useState("cities");
  const [scope, setScope] = useState("china");
  const [zoom, setZoom] = useState(1);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const visited = state.trips.filter(isVisited);
  const places = visited.map((t) => ({
    trip: t,
    place: catalog(state).find((d) => t.destination.includes(d.name)),
  }));
  const cities = new Set(visited.map((t) => t.destination));
  const known = places.filter((p) => p.place);
  const distance = known.reduce(
    (n, p, i) => (i ? n + haversine(known[i - 1].place!, p.place!) : n),
    0,
  );
  const companions = new Map<string, number>();
  visited.forEach((t) =>
    t.members
      .filter((m) => m.id !== state.userId)
      .forEach((m) =>
        companions.set(m.name, (companions.get(m.name) || 0) + 1),
      ),
  );
  const companion = [...companions].sort((a, b) => b[1] - a[1])[0];
  const photos = state.trips
    .flatMap((t) => (t.photos || []).map((p) => ({ ...p, trip: t })))
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  const upload = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      if (cloud)
        throw new Error(
          "当前照片墙使用浏览器存储，请切换本地模式使用；云端照片同步待配置。",
        );
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 10000000
      )
        throw new Error("请选择 10MB 内的 JPG/PNG/WebP");
      if ((trip.photos?.length || 0) >= 30)
        throw new Error("每场旅行最多30张，请先删除旧照片");
      const bmp = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
      canvas.width = Math.max(1, Math.round(bmp.width * scale));
      canvas.height = Math.max(1, Math.round(bmp.height * scale));
      canvas
        .getContext("2d")!
        .drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close();
      const src = canvas.toDataURL("image/jpeg", 0.7);
      if (src.length > 650000) throw new Error("照片压缩后仍过大，请换一张");
      if (
        await updateTrip((t) => ({
          ...t,
          photos: [
            ...(t.photos || []),
            {
              id: uid(),
              src,
              caption: file.name.slice(0, 150),
              takenAt: t.startDate,
              createdBy: state.userId,
            },
          ],
        }))
      )
        notify("照片已保存，去编辑拍摄日期与回忆吧");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const report = () => {
    if (!/^20\d{2}$/.test(year)) {
      notify("请选择2000—2099年的报告", "error");
      return;
    }
    const trips = visited.filter((t) => t.startDate.startsWith(year));
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 1400;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#f6efe4";
    c.fillRect(0, 0, 1000, 1400);
    c.fillStyle = "#756183";
    c.font = "28px sans-serif";
    c.fillText("MOODNOMAD · 情绪游牧", 80, 100);
    c.font = "bold 78px serif";
    c.fillText(`${year} 旅行手记`, 80, 240);
    c.fillStyle = "#d08f6d";
    c.font = "bold 120px serif";
    c.fillText(String(trips.length), 80, 440);
    c.font = "32px sans-serif";
    c.fillText("场旅行，收藏不一样的日常", 80, 510);
    c.fillStyle = "#54483f";
    c.font = "30px sans-serif";
    c.fillText(
      `${new Set(trips.map((t) => t.destination)).size} 座城市  ·  ${trips.reduce((n, t) => n + t.days.length, 0)} 天旅途`,
      80,
      610,
    );
    trips
      .slice(0, 7)
      .forEach((t, i) =>
        c.fillText(
          `${t.startDate}  ${t.destination}`.slice(0, 32),
          80,
          730 + i * 65,
        ),
      );
    c.font = "23px sans-serif";
    c.fillText("依据标记去过或有打卡的旅行记录生成", 80, 1290);
    canvas.toBlob((b) => {
      if (b) {
        downloadBlob(b, `MoodNomad-${year}-年度报告.png`);
        notify("年度报告已下载");
      }
    }, "image/png");
  };
  return (
    <div className="fade-in">
      <PageHeading
        eyebrow="COLLECT MOMENTS, NOT THINGS"
        title="每一步，都值得记得"
        description="用地点与照片，把一场旅行慢慢装进回忆。"
      />
      <div className="stat-grid">
        {[
          [cities.size, "去过的城市"],
          [visited.reduce((n, t) => n + t.days.length, 0), "旅行总天数"],
          [Math.round(distance), "跨目的地直线公里（估算）"],
          [companion?.[0] || "待相遇", "最常同行旅伴"],
        ].map(([v, l]) => (
          <section className="panel p-5" key={l}>
            <strong className="text-3xl">{v}</strong>
            <p>{l}</p>
          </section>
        ))}
      </div>
      <div className="filter-row my-5">
        {[
          ["cities", "城市地图"],
          ["trip", "当前行程地点"],
          ["photos", "回忆相册"],
          ["report", "年度报告"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "selected" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="panel p-5 my-5">
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="回忆旅行"
            value={trip.id}
            onChange={(e) => selectTrip(e.target.value)}
          >
            {state.trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <Button
            disabled={!canEdit}
            variant="secondary"
            onClick={() =>
              void updateTrip((t) => ({ ...t, visited: !isVisited(t) }))
            }
          >
            {isVisited(trip) ? "已去过 · 取消标记" : "标记这场旅行已去过"}
          </Button>
        </div>
        <p className="form-note">
          地图依据已打卡或手动标记的旅行点亮；未知城市坐标不会虚构。
        </p>
      </section>
      {tab === "trip" && <Footprints />}
      {tab === "cities" && (
        <section className="panel p-5">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setScope(scope === "china" ? "world" : "china");
                setZoom(1);
              }}
            >
              {scope === "china" ? "切换世界" : "切换中国"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setZoom(Math.min(3, zoom + 0.5))}
            >
              放大 +
            </Button>
            <Button
              variant="secondary"
              onClick={() => setZoom(Math.max(1, zoom - 0.5))}
            >
              缩小 −
            </Button>
          </div>
          <div className="atlas-scroll">
            <svg
              role="img"
              aria-label="已去过城市地图"
              className="atlas"
              style={{ width: `${zoom * 100}%`, minWidth: "100%" }}
              viewBox={scope === "china" ? "70 -56 68 42" : "-180 -85 360 170"}
            >
              {world.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill="var(--map-land,#e5ded0)"
                  stroke="#b3a89a"
                  strokeWidth=".15"
                />
              ))}
              {known.map(({ trip: t, place: d }, i) => (
                <g
                  key={t.id}
                  onClick={() => selectTrip(t.id)}
                  style={{ cursor: "pointer" }}
                >
                  <title>
                    {t.title} · {t.startDate}
                  </title>
                  <circle
                    cx={d!.longitude}
                    cy={-d!.latitude}
                    r={scope === "china" ? 0.65 : 1.6}
                    fill={trip.id === t.id ? "#d48663" : "#9274a3"}
                  />
                  <text
                    x={d!.longitude + 1}
                    y={-d!.latitude - 0.7}
                    fontSize={scope === "china" ? 1.5 : 3}
                    fill="var(--map-text,#4d4052)"
                  >
                    {d!.name}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <p className="form-note">
            Natural Earth
            公共领域地理数据，示意用途；支持缩放后横向滚动。里程按当前旅行列表相邻目的地的直线距离累计，并非实际交通里程。
          </p>
          {!visited.length && (
            <Empty
              title="第一座点亮的城市，等你出发"
              description="给旅行标记去过，或在行程中完成一次打卡。"
            />
          )}
        </section>
      )}
      {tab === "photos" && (
        <>
          <section className="panel p-5">
            <h3>把照片放进「{trip.title}」</h3>
            <label className="upload-photo">
              {busy ? "正在压缩保存…" : "＋ 上传旅行照片"}
              <input
                aria-label="上传旅行照片"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy || !canEdit}
                onChange={(e) => {
                  if (e.target.files?.[0]) void upload(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="form-note">
              照片压缩后保存在本浏览器，备份 JSON
              会包含照片。不会读取或上传到公开服务。
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
          </section>
          <div className="memory-timeline">
            {[...new Set(photos.map((p) => p.takenAt))].map((date) => (
              <section key={date}>
                <h3 className="memory-date">{date}</h3>
                <div className="photo-wall">
                  {photos
                    .filter((p) => p.takenAt === date)
                    .map((p) => (
                      <article className="panel" key={p.id}>
                        <img src={p.src} alt={p.caption} />
                        <div className="p-4">
                          <small>
                            {p.takenAt} · {p.trip.destination}
                          </small>
                          <h3>{p.caption}</h3>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              selectTrip(p.trip.id);
                              setEdit(p.id);
                            }}
                          >
                            编辑回忆
                          </Button>
                        </div>
                      </article>
                    ))}
                </div>
              </section>
            ))}
          </div>
          {!photos.length && (
            <Empty
              title="还没有照片，但故事已经开始"
              description="选择一场旅行，上传第一张回忆。"
            />
          )}
        </>
      )}
      {tab === "report" && (
        <section className="panel p-8">
          <h2>这一年，走过的路都有回响</h2>
          <Field label="报告年份">
            <input
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </Field>
          <p>
            {year} 年有{" "}
            {visited.filter((t) => t.startDate.startsWith(year)).length}{" "}
            场已去过的旅行。可下载 PNG 分享。
          </p>
          <Button onClick={report}>下载年度旅行报告</Button>
        </section>
      )}
      {edit && trip.photos?.find((p) => p.id === edit) && (
        <Modal title="编辑这段回忆" onClose={() => setEdit(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await updateTrip((t) => ({
                  ...t,
                  photos: t.photos?.map((p) =>
                    p.id === edit
                      ? {
                          ...p,
                          caption: String(f.get("caption")),
                          takenAt: String(f.get("date")),
                        }
                      : p,
                  ),
                }))
              )
                setEdit(null);
            }}
          >
            <Field label="照片小记">
              <input
                name="caption"
                defaultValue={trip.photos.find((p) => p.id === edit)?.caption}
                maxLength={200}
              />
            </Field>
            <Field label="拍摄日期">
              <input
                name="date"
                type="date"
                required
                defaultValue={trip.photos.find((p) => p.id === edit)?.takenAt}
              />
            </Field>
            <div className="flex gap-3">
              <Button type="submit">保存回忆</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  if (
                    await updateTrip((t) => ({
                      ...t,
                      photos: t.photos?.filter((p) => p.id !== edit),
                    }))
                  )
                    setEdit(null);
                }}
              >
                删除照片
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
