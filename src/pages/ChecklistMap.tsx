import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Flag,
  Globe2,
  ListChecks,
  LockKeyhole,
  MapPin,
  Pencil,
  Plus,
  Route,
  Trash2,
} from "lucide-react";
import { useMood } from "../context";
import {
  Avatar,
  Button,
  Empty,
  Field,
  IconButton,
  Modal,
  PageHeading,
} from "../components/UI";
import type { Activity, ChecklistItem } from "../domain/types";
import { uid } from "../domain/types";
import "leaflet/dist/leaflet.css";
export function Checklist() {
  const { trip, state, updateTrip, canEdit, saving, notify } = useMood();
  const [scope, setScope] = useState("public");
  const [filter, setFilter] = useState("全部");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ChecklistItem | null>(null);
  const [error, setError] = useState("");
  const visible = trip.checklist.filter((c) =>
    scope === "private"
      ? c.private && c.createdBy === state.userId
      : !c.private,
  );
  const items = visible.filter(
    (c) =>
      filter === "全部" ||
      (filter === "未完成" && !c.done) ||
      (filter === "已完成" && c.done),
  );
  const done = visible.filter((c) => c.done).length;
  return (
    <div className="fade-in">
      <PageHeading
        eyebrow="A LITTLE PREPARATION, A BETTER JOURNEY"
        title="准备妥当，轻装出发"
        description="那些出发前的小事，一起记着，一起完成。"
        action={
          <Button
            disabled={!canEdit}
            onClick={() => {
              setEditing(null);
              setAdding(true);
            }}
          >
            <Plus size={17} />
            添加清单
          </Button>
        }
      />
      <div className="context-line">
        <span className="context-dot" />
        {trip.title}
      </div>
      <div className="checklist-hero">
        <div className="checklist-illustration">
          <ListChecks size={47} />
          <span>
            <Check size={15} />
          </span>
        </div>
        <div>
          <h2>
            {done === visible.length && done
              ? "都准备好啦，下一步就是出发。"
              : "少一点临时慌张，多一点从容。"}
          </h2>
          <p>
            已完成 {done} / {visible.length} 项准备
          </p>
          <div className="budget-track">
            <span
              style={{
                width: `${visible.length ? (done / visible.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
        <strong>
          {visible.length ? Math.round((done / visible.length) * 100) : 0}
          <small>%</small>
        </strong>
      </div>
      <div className="checklist-toolbar">
        <div className="segmented">
          <button
            className={scope === "public" ? "selected" : ""}
            onClick={() => setScope("public")}
          >
            一起准备 · 公共清单
          </button>
          <button
            className={scope === "private" ? "selected" : ""}
            onClick={() => setScope("private")}
          >
            <LockKeyhole size={14} />
            我的个人清单
          </button>
        </div>
        <select
          aria-label="清单完成状态"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option>全部</option>
          <option>未完成</option>
          <option>已完成</option>
        </select>
      </div>
      <section className="panel checklist-items">
        {items.length ? (
          (["预订", "物品", "待办"] as const).map((cat) => {
            const group = items.filter((c) => c.category === cat);
            return group.length ? (
              <section className="checklist-group" key={cat}>
                <h3>
                  {cat === "预订"
                    ? "先把期待预订好"
                    : cat === "物品"
                      ? "放进行李箱的小安心"
                      : "出发前，再确认一下"}
                  <span>{group.length}</span>
                </h3>
                {group.map((c) => (
                  <div
                    className={`checklist-row ${c.done ? "done" : ""}`}
                    key={c.id}
                  >
                    <button
                      className={`checkbox ${c.done ? "checked" : ""}`}
                      aria-label={`${c.done ? "取消完成" : "完成"}${c.title}`}
                      disabled={!canEdit || saving}
                      onClick={() =>
                        void updateTrip((t) => ({
                          ...t,
                          checklist: t.checklist.map((x) =>
                            x.id === c.id ? { ...x, done: !x.done } : x,
                          ),
                        }))
                      }
                    >
                      {c.done && <Check size={13} />}
                    </button>
                    <div className="checklist-title">
                      <strong>{c.title}</strong>
                      <small>
                        {c.dueDate
                          ? `${c.dueDate.slice(5).replace("-", "月")}日前准备`
                          : "不着急，慢慢来"}
                        {c.private && (
                          <>
                            <span>·</span>
                            <LockKeyhole size={11} />
                            仅自己可见
                          </>
                        )}
                      </small>
                    </div>
                    <span className="checklist-assignee">
                      {trip.members.find((m) => m.id === c.assigneeId) && (
                        <Avatar
                          member={trip.members.find(
                            (m) => m.id === c.assigneeId,
                          )!}
                          size="small"
                        />
                      )}
                      {trip.members.find((m) => m.id === c.assigneeId)?.name ||
                        "未分配"}
                    </span>
                    <IconButton
                      label={`编辑${c.title}`}
                      disabled={!canEdit}
                      onClick={() => {
                        setEditing(c);
                        setAdding(true);
                      }}
                    >
                      <Pencil size={15} />
                    </IconButton>
                    <IconButton
                      label={`删除${c.title}`}
                      disabled={!canEdit}
                      onClick={async () => {
                        if (
                          await updateTrip((t) => ({
                            ...t,
                            checklist: t.checklist.filter((x) => x.id !== c.id),
                          }))
                        )
                          notify("已移除这项准备");
                      }}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                ))}
              </section>
            ) : null;
          })
        ) : (
          <Empty
            title="行李很轻，期待很满"
            description="添加一项待办、物品或预订，把准备工作交给清单。"
            action={
              <Button
                disabled={!canEdit}
                onClick={() => {
                  setEditing(null);
                  setAdding(true);
                }}
              >
                添加第一项
              </Button>
            }
          />
        )}
      </section>
      {adding && (
        <Modal title="记住一件出发前的小事" onClose={() => setAdding(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const title = String(f.get("title")).trim();
              if (!title) {
                setError("请填写清单内容");
                return;
              }
              if (
                await updateTrip((t) => ({
                  ...t,
                  checklist: [
                    ...t.checklist.filter((c) => c.id !== editing?.id),
                    {
                      id: editing?.id || uid(),
                      title,
                      category: String(
                        f.get("category"),
                      ) as ChecklistItem["category"],
                      assigneeId: String(f.get("assignee")),
                      dueDate: String(f.get("due")),
                      private: editing?.private ?? scope === "private",
                      createdBy: editing?.createdBy || state.userId,
                      done: editing?.done || false,
                    },
                  ],
                }))
              ) {
                setAdding(false);
                notify("已记进清单，出发前不会忘记啦");
              }
            }}
          >
            <Field label="要准备什么">
              <input
                name="title"
                defaultValue={editing?.title}
                maxLength={100}
                required
                autoFocus
                placeholder="例如：带上充电宝"
              />
            </Field>
            <div className="form-row">
              <Field label="清单分类">
                <select
                  name="category"
                  defaultValue={editing?.category || "物品"}
                >
                  <option>物品</option>
                  <option>待办</option>
                  <option>预订</option>
                </select>
              </Field>
              <Field label="谁来负责">
                <select
                  name="assignee"
                  defaultValue={editing?.assigneeId || state.userId}
                >
                  {trip.members.map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="准备日期（选填）">
              <input
                name="due"
                type="date"
                defaultValue={editing?.dueDate || trip.startDate}
              />
            </Field>
            <p className="form-note">
              保存到
              {scope === "private"
                ? "个人清单，仅自己可见"
                : "公共清单，所有同行成员可见"}
              。
            </p>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAdding(false)}
              >
                取消
              </Button>
              <Button disabled={saving} type="submit">
                记进清单
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
export function Footprints() {
  const { trip, updateTrip, canEdit, setView } = useMood();
  const [dayId, setDayId] = useState("all");
  const [online, setOnline] = useState(false);
  const [selected, setSelected] = useState("");
  const days =
    dayId === "all" ? trip.days : trip.days.filter((d) => d.id === dayId);
  const items = days
    .flatMap((d) => d.items)
    .filter(
      (a): a is Activity & { lat: number; lng: number } =>
        typeof a.lat === "number" && typeof a.lng === "number",
    );
  const selectedItem = items.find((a) => a.id === selected) || items[0];
  const done = items.filter((a) => a.done).length;
  return (
    <div className="fade-in">
      <PageHeading
        eyebrow="PLACES BECOME MEMORIES"
        title="走过的地方，都算数"
        description="不追踪你的位置，只收藏主动留下的足迹。"
        action={
          <Button variant="secondary" onClick={() => setView("trips")}>
            编辑行程地点
            <ChevronRight size={16} />
          </Button>
        }
      />
      <div className="context-line">
        <span className="context-dot" />
        {trip.destination}
        <span className="pill pill-green">{done} 个地点已打卡</span>
        <span className="subtle">{items.length} 个有坐标的地点</span>
      </div>
      <div className="map-toolbar">
        <div className="day-filter">
          <select
            aria-label="地图行程日期"
            value={dayId}
            onChange={(e) => setDayId(e.target.value)}
          >
            <option value="all">全部日程</option>
            {trip.days.map((d, i) => (
              <option key={d.id} value={d.id}>
                第 {i + 1} 天 · {d.theme}
              </option>
            ))}
          </select>
        </div>
        <button
          className={`map-mode ${online ? "active" : ""}`}
          onClick={() => setOnline(!online)}
        >
          <Globe2 size={16} />
          {online ? "切换离线示意图" : "加载在线地图"}
        </button>
      </div>
      {items.length ? (
        <div className="map-layout">
          <section className="map-panel">
            {online ? (
              <OnlineMap
                items={items}
                selected={selectedItem?.id}
                onSelect={setSelected}
              />
            ) : (
              <SchematicMap
                items={items}
                selected={selectedItem?.id}
                onSelect={setSelected}
              />
            )}
            <span className="map-caption">
              <Route size={13} />
              {online
                ? "地点按行程顺序连线，不代表道路或导航路线"
                : "行程位置示意 · 非导航地图 · 无需定位授权"}
            </span>
          </section>
          <aside className="panel map-places">
            <h2>
              一路的小美好 <span>{items.length}</span>
            </h2>
            {items.map((a, i) => (
              <button
                className={`map-place ${selectedItem?.id === a.id ? "selected" : ""}`}
                key={a.id}
                onClick={() => setSelected(a.id)}
              >
                <span className={`map-number ${a.done ? "done" : ""}`}>
                  {a.done ? <Check size={13} /> : i + 1}
                </span>
                <span>
                  <strong>{a.name}</strong>
                  <small>{a.done ? "已留下足迹" : "等待一次相遇"}</small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
            {selectedItem && (
              <div className="selected-place">
                <span className="eyebrow">选中的目的地</span>
                <h3>{selectedItem.name}</h3>
                <p>
                  <MapPin size={13} />
                  {selectedItem.address}
                </p>
                <Button
                  className="full-width"
                  disabled={!canEdit}
                  onClick={() =>
                    void updateTrip((t) => ({
                      ...t,
                      days: t.days.map((d) => ({
                        ...d,
                        items: d.items.map((a) =>
                          a.id === selectedItem.id
                            ? { ...a, done: !a.done }
                            : a,
                        ),
                      })),
                    }))
                  }
                >
                  <Flag size={15} />
                  {selectedItem.done ? "取消打卡" : "在这里，留下足迹"}
                </Button>
                <a
                  className="external-map-link"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.openstreetmap.org/?mlat=${selectedItem.lat}&mlon=${selectedItem.lng}#map=15/${selectedItem.lat}/${selectedItem.lng}`}
                >
                  在 OpenStreetMap 查看位置 ↗
                </a>
              </div>
            )}
          </aside>
        </div>
      ) : (
        <Empty
          title="让第一个地点，成为第一段回忆"
          description="在行程中填写地点经纬度，就能在这里看到标记；没有坐标的安排仍可正常使用。"
          action={<Button onClick={() => setView("trips")}>去添加地点</Button>}
        />
      )}
      <p className="bottom-note">
        <LockKeyhole size={15} />
        离线示意图不请求位置或第三方地图。加载在线地图后，浏览器会向
        OpenStreetMap 请求瓦片。
      </p>
    </div>
  );
}
function SchematicMap({
  items,
  selected,
  onSelect,
}: {
  items: (Activity & { lat: number; lng: number })[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const lats = items.map((a) => a.lat),
    lngs = items.map((a) => a.lng);
  const minLat = Math.min(...lats),
    maxLat = Math.max(...lats),
    minLng = Math.min(...lngs),
    maxLng = Math.max(...lngs);
  const points = items.map((a, i) => ({
    ...a,
    x: 100 + ((a.lng - minLng) / (maxLng - minLng || 1)) * 460,
    y: 380 - ((a.lat - minLat) / (maxLat - minLat || 1)) * 280,
    index: i,
  }));
  return (
    <svg
      viewBox="0 0 700 480"
      className="schematic-map"
      aria-label="行程地点示意图"
    >
      <defs>
        <pattern id="grid" width="38" height="38" patternUnits="userSpaceOnUse">
          <path
            d="M 38 0 L 0 0 0 38"
            fill="none"
            stroke="#dfe2d8"
            strokeWidth="0.65"
          />
        </pattern>
      </defs>
      <rect width="700" height="480" fill="#edf0e7" />
      <rect width="700" height="480" fill="url(#grid)" />
      <path
        d="M420 -20 C290 90 460 150 370 250 S450 450 350 520 L700 520 700 -20Z"
        fill="#c8dfe1"
      />
      <path
        d="M440 -20 C310 90 480 150 390 250 S470 450 370 520"
        fill="none"
        stroke="#b0cfd4"
        strokeWidth="3"
      />
      <path
        d="M-20 170 Q120 70 230 160 T410 100 M20 410 Q130 230 240 320 T530 240"
        fill="none"
        stroke="#fff"
        strokeWidth="16"
      />
      <path
        d="M-20 170 Q120 70 230 160 T410 100 M20 410 Q130 230 240 320 T530 240"
        fill="none"
        stroke="#d4d9cb"
        strokeWidth="1"
      />
      <g opacity=".65" fill="#b8c7a7">
        <circle cx="56" cy="47" r="57" />
        <circle cx="112" cy="50" r="35" />
        <circle cx="610" cy="390" r="64" />
        <circle cx="650" cy="320" r="45" />
      </g>
      <text
        x="510"
        y="185"
        fill="#83a9af"
        fontSize="25"
        letterSpacing="12"
        transform="rotate(-10 510 185)"
      >
        湖与远山
      </text>
      <text x="40" y="450" fill="#7f8d78" fontSize="12" letterSpacing="2">
        SLOW DOWN & WANDER
      </text>
      <polyline
        points={points.map((a) => `${a.x},${a.y}`).join(" ")}
        fill="none"
        stroke="#9277a4"
        strokeWidth="2.5"
        strokeDasharray="7 6"
      />
      {points.map((a) => (
        <g
          key={a.id}
          role="button"
          tabIndex={0}
          aria-label={`选择${a.name}`}
          onClick={() => onSelect(a.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(a.id);
            }
          }}
          className="svg-pin"
        >
          <circle
            cx={a.x}
            cy={a.y}
            r={a.id === selected ? 23 : 17}
            fill="white"
            opacity={a.id === selected ? ".6" : "1"}
          />
          <circle
            cx={a.x}
            cy={a.y}
            r="15"
            fill={a.done ? "#789a85" : "#8e73a0"}
          />
          <text
            x={a.x}
            y={a.y + 5}
            fontSize="13"
            fill="white"
            textAnchor="middle"
          >
            {a.done ? "✓" : a.index + 1}
          </text>
          <rect
            x={a.x - 56}
            y={a.y + 23}
            width="112"
            height="24"
            rx="7"
            fill="white"
            opacity=".92"
          />
          <text
            x={a.x}
            y={a.y + 39}
            fill="#61566a"
            fontSize="10"
            textAnchor="middle"
          >
            {a.name.slice(0, 10)}
          </text>
        </g>
      ))}
      <g transform="translate(642 32)">
        <circle r="20" fill="white" />
        <text y="-3" textAnchor="middle" fontSize="9" fill="#86758b">
          N
        </text>
        <path d="M0 -1 L-5 10 L0 7 L5 10Z" fill="#86758b" />
      </g>
    </svg>
  );
}
function OnlineMap({
  items,
  selected,
  onSelect,
}: {
  items: (Activity & { lat: number; lng: number })[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    void import("leaflet")
      .then((L) => {
        if (disposed || !ref.current) return;
        map = L.map(ref.current, { scrollWheelZoom: false }).setView(
          [items[0].lat, items[0].lng],
          12,
        );
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        })
          .on("tileerror", () => setError(true))
          .addTo(map);
        const coords = items.map((a, i) => {
          L.marker([a.lat, a.lng], {
            icon: L.divIcon({
              className: "leaflet-mood-pin",
              html: `<span style="background:${a.id === selected ? "#6e527f" : a.done ? "#739480" : "#a48eb2"}">${i + 1}</span>`,
              iconSize: [30, 30],
            }),
          })
            .on("click", () => onSelect(a.id))
            .addTo(map!);
          return [a.lat, a.lng] as [number, number];
        });
        L.polyline(coords, { color: "#8d739f", dashArray: "5 7" }).addTo(map);
        if (coords.length > 1)
          map.fitBounds(L.latLngBounds(coords), {
            padding: [45, 45],
            maxZoom: 14,
          });
      })
      .catch(() => setError(true));
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [
    items.map((a) => `${a.id}:${a.lat}:${a.lng}`).join("|"),
    selected,
    onSelect,
  ]);
  return (
    <>
      <div className="online-map" ref={ref} />
      {error && (
        <div className="map-error" role="status">
          在线底图未能加载，地点仍可查看。可切回离线示意图继续使用。
        </div>
      )}
    </>
  );
}
