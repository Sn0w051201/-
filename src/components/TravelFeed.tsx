import { useEffect, useState } from "react";
import { useMood } from "../context";
import { catalog } from "../data/destinations";
export default function TravelFeed() {
  const { state, trip } = useMood();
  const [weather, setWeather] = useState("");
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  const days = Math.ceil(
    (new Date(trip.startDate + "T00:00:00").getTime() -
      new Date(new Date().toDateString()).getTime()) /
      86400000,
  );
  const city = catalog(state).find((d) => trip.destination.includes(d.name));
  useEffect(() => {
    const abort = new AbortController();
    setWeather("正在查看目的地天气…");
    setFailed(false);
    if (!city) {
      setWeather("未找到目的地坐标，请查询当地天气预报。");
      return;
    }
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m,precipitation&timezone=auto`,
      { signal: abort.signal },
    )
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        clearTimeout(timer);
        setWeather(
          `${city.name} 当前 ${d.current.temperature_2m}°C · ${d.current.precipitation > 0 ? "有降水，请备雨具" : "暂无降水"}（${d.current.time.replace("T", " ")} 当地时间）`,
        );
      })
      .catch(() => {
        clearTimeout(timer);
        if (!abort.signal.aborted) {
          setWeather("天气暂时不可用，出发前请核验当地预报。");
          setFailed(true);
        }
      });
    const timer = setTimeout(() => {
      abort.abort();
      setWeather("天气请求超时，请出发前核验当地预报。");
      setFailed(true);
    }, 10000);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [city?.id, retry]);
  return (
    <div className="feed-grid my-5">
      <section className="panel p-5">
        <span className="eyebrow">NEXT CHAPTER</span>
        <h2 className="my-3">
          {!trip.id
            ? "下一段旅行，等你开启"
            : days > 0
              ? `距离出发还有 ${days} 天`
              : days >= -trip.days.length + 1
                ? "旅行进行中，享受此刻"
                : "旅程已结束，回忆正新鲜"}
        </h2>
        <p>
          {trip.destination} · {trip.startDate}
        </p>
      </section>
      <section className="panel p-5">
        <h3>带着好天气出发</h3>
        <p className="my-3">{weather}</p>
        {failed && (
          <button onClick={() => setRetry(retry + 1)}>重试天气</button>
        )}
        <small>Open-Meteo 当前观测模型；不代表未来出行日天气。</small>
      </section>
      <section className="panel p-5">
        <h3>最近的旅行动态</h3>
        {state.feed?.length ? (
          state.feed.slice(0, 3).map((f) => (
            <p className="my-3" key={f.id}>
              {f.text}
              <small className="block">{new Date(f.at).toLocaleString()}</small>
            </p>
          ))
        ) : (
          <p className="my-3">
            还没有动态。编辑行程、记一笔账或上传照片，从这里开始积累。
          </p>
        )}
      </section>
    </div>
  );
}
