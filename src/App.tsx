import { clearPlanDraft } from "./services/plan-job";
import Discover from "./pages/Discover";
import { catalog } from "./data/destinations";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  Heart,
  LayoutGrid,
  ListChecks,
  LoaderCircle,
  Map,
  MapPin,
  Menu,
  Mountain,
  Plus,
  Search,
  Settings,
  Share2,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { Mood, useMood } from "./context";
import type { View } from "./context";
import type { AppState, Trip } from "./domain/types";
import { uid } from "./domain/types";
import { validateTrip } from "./domain/trip-schema";
import { loadState, saveState } from "./services/storage";
import { seedState } from "./data/seed";
import { cloudCall } from "./services/cloud";
import { Avatar, Button, Field, IconButton, Modal } from "./components/UI";
import { parseMoney } from "./domain/money";
import Dashboard from "./pages/Dashboard";
import Itinerary from "./pages/Itinerary";
import Planner from "./pages/Planner";
import { Checklist, Footprints } from "./pages/ChecklistMap";
import Share from "./pages/Share";
import SettingsPage from "./pages/Settings";
import SharedPage from "./pages/SharedPage";
const Memories = lazy(() => import("./pages/Memories"));
const Ledger = lazy(() => import("./pages/Ledger"));
const nav = [
  { id: "discover", name: "发现目的地", icon: MapPin },
  { id: "dashboard", name: "旅行总览", icon: LayoutGrid },
  { id: "trips", name: "我的行程", icon: Compass },
  { id: "planner", name: "AI 灵感规划", icon: Sparkles, badge: "AI" },
  { id: "ledger", name: "旅行账本", icon: Wallet },
  { id: "checklist", name: "行前清单", icon: ListChecks },
  { id: "map", name: "旅行足迹", icon: Map },
] as const;
const views = [
  "discover",
  "dashboard",
  "trips",
  "planner",
  "ledger",
  "checklist",
  "map",
  "share",
  "settings",
];
export default function App() {
  const sharedToken = new URLSearchParams(location.hash.slice(1)).get("s");
  const [initial] = useState(loadState);
  const [state, setState] = useState<AppState>(initial.state);
  const latest = useRef(state);
  latest.current = state;
  const [view, setViewState] = useState<View>(
    views.includes(location.hash.slice(1))
      ? (location.hash.slice(1) as View)
      : "dashboard",
  );
  const [showCreate, setShowCreate] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: string } | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [booting, setBooting] = useState(
    import.meta.env.VITE_DATA_MODE === "cloud",
  );
  const [cloudError, setCloudError] = useState("");
  const [planningDestination, setPlanningDestination] = useState("");
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        (state.preferences?.theme || "system") === "system"
          ? media.matches
            ? "dark"
            : "light"
          : state.preferences!.theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [state.preferences?.theme]);
  const cloud = import.meta.env.VITE_DATA_MODE === "cloud";
  const notify = useCallback(
    (text: string, tone = "success") => setToast({ text, tone }),
    [],
  );
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4200);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (initial.error) notify(initial.error, "error");
  }, [initial.error, notify]);
  const setView = useCallback((v: View) => {
    setViewState(v);
    setMobile(false);
    history.replaceState(null, "", `#${v}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  useEffect(() => {
    const fn = () => {
      const next = location.hash.slice(1);
      if (views.includes(next)) setViewState(next as View);
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  const persist = useCallback(
    (next: AppState) => {
      try {
        if (!cloud) saveState(next);
        latest.current = next;
        setState(next);
        return true;
      } catch {
        notify("存储空间不足，本次修改未保存。请导出备份并减少照片。", "error");
        return false;
      }
    },
    [cloud, notify],
  );
  const bootstrap = useCallback(async () => {
    if (!cloud || sharedToken) return;
    setBooting(true);
    setCloudError("");
    try {
      persist((await cloudCall("bootstrap")) as AppState);
    } catch (e) {
      setCloudError((e as Error).message);
    } finally {
      setBooting(false);
    }
  }, [cloud, persist, sharedToken]);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
  const trip = state.trips.find((t) => t.id === state.activeTripId) ||
    state.trips[0] || {
      ...seedState().trips[0],
      id: "",
      members: [],
      days: [],
      expenses: [],
      checklist: [],
      title: "还没有旅行",
    };
  const role = trip.members.find((m) => m.id === state.userId)?.role;
  const updateTrip = useCallback(
    async (recipe: (t: Trip) => Trip) => {
      if (saveLock.current) return false;
      const current =
        latest.current.trips.find(
          (t) => t.id === latest.current.activeTripId,
        ) || latest.current.trips[0];
      if (!current) {
        notify("请先创建旅行", "error");
        return false;
      }
      if (
        current.members.find((m) => m.id === latest.current.userId)?.role ===
        "viewer"
      ) {
        notify("只读成员不能修改旅行", "error");
        return false;
      }
      setSaving(true);
      saveLock.current = true;
      try {
        let next = recipe(structuredClone(current));
        next = validateTrip(
          { ...next, version: current.version + 1 },
          cloud ? 900000 : 4500000,
        );
        if (cloud)
          next = (await cloudCall("saveTrip", {
            trip: next,
            expectedVersion: current.version,
          })) as Trip;
        return persist({
          ...latest.current,
          trips: latest.current.trips.map((t) => (t.id === next.id ? next : t)),
          feed: [
            {
              id: uid(),
              tripId: next.id,
              text: `更新了「${next.title}」的旅行记录`,
              at: new Date().toISOString(),
            },
            ...(latest.current.feed || []),
          ].slice(0, 60),
        });
      } catch (e) {
        notify((e as Error).message, "error");
        return false;
      } finally {
        setSaving(false);
        saveLock.current = false;
      }
    },
    [cloud, notify, persist],
  );
  const createTrip = async (newTrip: Trip) => {
    if (saveLock.current) return;
    setSaving(true);
    saveLock.current = true;
    try {
      validateTrip(newTrip, cloud ? 900000 : 4500000);
      const saved = cloud
        ? ((await cloudCall("createTrip", { trip: newTrip })) as Trip)
        : newTrip;
      if (
        !persist({
          ...latest.current,
          trips: [saved, ...latest.current.trips],
          activeTripId: saved.id,
        })
      )
        return;
      clearPlanDraft();
      setShowCreate(false);
      setView("trips");
      notify("新的旅行已创建，去填满它吧");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSaving(false);
      saveLock.current = false;
    }
  };
  if (sharedToken) return <SharedPage token={sharedToken} />;
  return (
    <Mood.Provider
      value={{
        planningDestination,
        planFor: (destination) => {
          setPlanningDestination(destination);
          setView("planner");
        },
        updateApp: (recipe) => persist(recipe(latest.current)),
        state,
        trip,
        view,
        setView,
        selectTrip: (id) => persist({ ...latest.current, activeTripId: id }),
        updateTrip,
        createTrip,
        openCreate: () => setShowCreate(true),
        notify,
        updateProfile: (name) => {
          persist({
            ...latest.current,
            profile: { name },
            trips: cloud
              ? latest.current.trips
              : latest.current.trips.map((t) => ({
                  ...t,
                  members: t.members.map((m) =>
                    m.id === latest.current.userId ? { ...m, name } : m,
                  ),
                })),
          });
        },
        resetDemo: () => {
          if (cloud) return;
          clearPlanDraft();
          persist(seedState());
          notify("已恢复初始示例旅行");
          setView("dashboard");
        },
        canEdit: role === "owner" || role === "editor",
        isOwner: role === "owner",
        saving,
        cloud,
      }}
    >
      <div className="app-shell">
        {mobile && (
          <div className="sidebar-backdrop" onClick={() => setMobile(false)} />
        )}
        <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
          <a
            className="brand"
            href="#dashboard"
            onClick={() => setView("dashboard")}
          >
            <span className="brand-icon">
              <Mountain size={25} />
              <span />
            </span>
            <span>
              <strong>
                MoodNomad<span className="brand-dot">.</span>
              </strong>
              <small>情 绪 游 牧</small>
            </span>
          </a>
          <div className="sidebar-label">每一程，都有好心情</div>
          <nav aria-label="主导航">
            {nav.map((n) => (
              <button
                key={n.id}
                aria-label={n.name}
                className={`nav-link ${view === n.id ? "active" : ""}`}
                onClick={() => setView(n.id)}
              >
                <n.icon size={19} />
                <span>{n.name}</span>
                {"badge" in n && <em>{n.badge}</em>}
                {view === n.id && <span className="nav-indicator" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-trip">
            <span className="sidebar-label">这次，想去哪里？</span>
            <div className="tiny-landscape">
              <Mountain size={49} />
              <span className="tiny-sun" />
            </div>
            <h3>好风景，值得一起看</h3>
            <p>
              把想去的地方
              <br />
              变成我们去过的地方。
            </p>
            <button onClick={() => setShowCreate(true)}>
              开启新的旅行 <Plus size={15} />
            </button>
          </div>
          <div className="sidebar-bottom">
            <button
              className={`nav-link ${view === "share" ? "active" : ""}`}
              onClick={() => setView("share")}
            >
              <Share2 size={18} />
              <span>分享海报</span>
            </button>
            <button
              className={`nav-link ${view === "settings" ? "active" : ""}`}
              onClick={() => setView("settings")}
            >
              <Settings size={18} />
              <span>偏好与数据</span>
            </button>
            <div className="sidebar-profile">
              <Avatar member={{ name: state.profile.name, color: "#9279a4" }} />
              <div>
                <strong>{state.profile.name}</strong>
                <small>收藏生活里的小美好</small>
              </div>
              <Heart size={15} />
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="topbar-left">
              <IconButton
                label="打开导航"
                className="mobile-menu"
                onClick={() => setMobile(true)}
              >
                <Menu size={21} />
              </IconButton>
              <span className="breadcrumb">我的旅行空间</span>
              <ChevronRight size={13} />
              <strong>
                {nav.find((n) => n.id === view)?.name ||
                  (view === "share" ? "分享海报" : "偏好与数据")}
              </strong>
            </div>
            <div className="topbar-right">
              <div className="global-search">
                <Search size={16} />
                <input
                  aria-label="搜索旅行"
                  placeholder="搜索目的地、旅行…"
                  value={search}
                  onFocus={() => setSearchOpen(true)}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSearchOpen(true);
                  }}
                />
                {searchOpen && (
                  <>
                    <button
                      className="search-dismiss"
                      onClick={() => setSearchOpen(false)}
                      aria-label="关闭搜索"
                    >
                      <X size={13} />
                    </button>
                    <div className="search-results">
                      {state.trips
                        .filter((t) =>
                          (t.title + t.destination).includes(search),
                        )
                        .map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              persist({
                                ...latest.current,
                                activeTripId: t.id,
                              });
                              setView("trips");
                              setSearchOpen(false);
                              setSearch("");
                            }}
                          >
                            <MapPin size={15} />
                            <span>
                              {t.title}
                              <small>{t.destination}</small>
                            </span>
                            <ChevronRight size={15} />
                          </button>
                        ))}
                      {catalog(state)
                        .filter(
                          (d) =>
                            search &&
                            (
                              d.name +
                              d.region +
                              d.highlights.join("")
                            ).includes(search),
                        )
                        .slice(0, 8)
                        .map((d) => (
                          <button
                            key={d.id}
                            onClick={() => {
                              setPlanningDestination(d.name);
                              setView("planner");
                              setSearchOpen(false);
                            }}
                          >
                            <MapPin size={15} />
                            <span>
                              {d.name}
                              <small>目的地 · 开始规划</small>
                            </span>
                          </button>
                        ))}
                      {state.trips
                        .flatMap((t) =>
                          t.days.flatMap((day) =>
                            day.items
                              .filter((a) => search && a.name.includes(search))
                              .map((a) => (
                                <button
                                  key={a.id}
                                  onClick={() => {
                                    persist({
                                      ...latest.current,
                                      activeTripId: t.id,
                                    });
                                    setView("trips");
                                    setSearchOpen(false);
                                  }}
                                >
                                  {a.name}
                                  <small>{t.title}</small>
                                </button>
                              )),
                          ),
                        )
                        .slice(0, 8)}
                      {!state.trips.some(
                        (t) =>
                          (t.title + t.destination).includes(search) ||
                          t.days.some((d) =>
                            d.items.some(
                              (a) => search && a.name.includes(search),
                            ),
                          ),
                      ) &&
                        !catalog(state).some(
                          (d) =>
                            search &&
                            (
                              d.name +
                              d.region +
                              d.highlights.join("")
                            ).includes(search),
                        ) && (
                          <p>
                            没有找到相关旅行、地点或目的地，换个关键词试试。
                          </p>
                        )}
                    </div>
                  </>
                )}
              </div>
              <button
                className="theme-toggle"
                aria-label="切换深色模式"
                onClick={() =>
                  persist({
                    ...latest.current,
                    preferences: {
                      theme:
                        document.documentElement.dataset.theme === "dark"
                          ? "light"
                          : "dark",
                    },
                  })
                }
              >
                ◐
              </button>
              <button
                className="demo-badge"
                onClick={() => setView("settings")}
              >
                <span />
                {cloud ? "云端模式" : "本地存储"}
              </button>
              <button
                className="topbar-avatar"
                aria-label="个人设置"
                onClick={() => setView("settings")}
              >
                <Avatar
                  member={{ name: state.profile.name, color: "#9279a4" }}
                  size="small"
                />
                <ChevronDown size={13} />
              </button>
            </div>
          </header>
          <main className="content">
            {booting ? (
              <div className="startup">
                <LoaderCircle className="spin" />
                <h2>正在载入你的旅行…</h2>
              </div>
            ) : cloudError ? (
              <div className="error-state">
                <CircleHelp size={30} />
                <h2>暂时无法连接云端</h2>
                <p>{cloudError}</p>
                <Button onClick={() => void bootstrap()}>重新连接</Button>
              </div>
            ) : (
              <>
                {view === "dashboard" && <Dashboard />}
                {view === "trips" && <Itinerary />}
                {view === "planner" && (
                  <Planner key={planningDestination || trip.id} />
                )}
                {view === "ledger" && (
                  <Suspense
                    fallback={<div className="startup">正在展开旅行账本…</div>}
                  >
                    <Ledger />
                  </Suspense>
                )}
                {view === "checklist" && <Checklist />}
                {view === "map" && (
                  <Suspense
                    fallback={<div className="startup">正在整理旅行回忆…</div>}
                  >
                    <Memories />
                  </Suspense>
                )}
                {view === "discover" && <Discover />}
                {view === "share" && <Share />}
                {view === "settings" && <SettingsPage />}
              </>
            )}
          </main>
          <footer className="site-footer">
            <span>
              <Mountain size={15} /> MoodNomad · 情绪游牧
            </span>
            <span>
              旅途有风景，也有我们 <Heart size={12} />
            </span>
          </footer>
        </div>
      </div>
      {showCreate && <CreateTrip onClose={() => setShowCreate(false)} />}
      {toast && (
        <div className={`toast toast-${toast.tone}`} role="status">
          {toast.tone === "error" ? (
            <CircleHelp size={18} />
          ) : (
            <Check size={18} />
          )}
          <span>{toast.text}</span>
          <button aria-label="关闭提示" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </Mood.Provider>
  );
}
function CreateTrip({ onClose }: { onClose: () => void }) {
  const { state, createTrip, saving } = useMood();
  const [error, setError] = useState("");
  return (
    <Modal
      title="下一站，去哪里？"
      description="先定一个小小的目的地，剩下的慢慢计划。"
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            const budgetMinor = parseMoney(String(f.get("budget")));
            if (budgetMinor < 1) throw new Error("旅行预算需要大于 0");
            const destination = String(f.get("destination")).trim();
            if (!destination) throw new Error("请填写目的地");
            const count = Number(f.get("travelers"));
            const days = Number(f.get("days"));
            await createTrip({
              id: uid(),
              ownerId: state.userId,
              title:
                String(f.get("title")).trim() || `${destination}，一起出发`,
              destination,
              startDate: String(f.get("date")),
              budgetMinor,
              pace: "relaxed",
              interests: ["自然风光", "当地美食"],
              members: Array.from({ length: count }, (_, i) => ({
                id: i ? uid() : state.userId,
                name: i ? `旅伴 ${i + 1}` : state.profile.name,
                color: ["#9176a3", "#e3a080", "#8ca58f", "#86a7bf"][i % 4],
                role: i ? "editor" : "owner",
              })),
              days: Array.from({ length: days }, (_, i) => ({
                id: uid(),
                theme: `第 ${i + 1} 天 · 等待美好发生`,
                items: [],
              })),
              expenses: [],
              checklist: [],
              version: 1,
              cover: "lake",
            });
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <Field label="旅行名称">
          <input
            name="title"
            maxLength={50}
            placeholder="例如：去大理，把日子过慢一点"
          />
        </Field>
        <Field label="目的地">
          <input
            name="destination"
            required
            maxLength={30}
            placeholder="你想去的城市"
            autoFocus
          />
        </Field>
        <div className="form-row">
          <Field label="出发日期">
            <input
              name="date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </Field>
          <Field label="旅行天数">
            <input
              name="days"
              type="number"
              min="1"
              max="14"
              defaultValue="5"
              required
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="总预算（元）">
            <input
              name="budget"
              inputMode="decimal"
              defaultValue="8000"
              required
            />
          </Field>
          <Field label="同行人数（含自己）">
            <input
              name="travelers"
              type="number"
              min="1"
              max="20"
              defaultValue="4"
              required
            />
          </Field>
        </div>
        <p className="form-note">
          演示模式中的旅伴是本地角色，不会自动邀请真实用户。
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            再想想
          </Button>
          <Button disabled={saving} type="submit">
            {saving ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Plus size={17} />
            )}
            创建旅行
          </Button>
        </div>
      </form>
    </Modal>
  );
}
