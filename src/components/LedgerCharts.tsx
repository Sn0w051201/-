import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { useMood } from "../context";
import { categories } from "../domain/types";
import { money } from "../domain/money";
const colors = [
  "#a58bb4",
  "#e6a282",
  "#86a995",
  "#8eafc5",
  "#d8bf8a",
  "#c9bdcf",
];
export default function LedgerCharts() {
  const { trip, state } = useMood();
  const category = categories
    .map((name) => ({
      name,
      value:
        trip.expenses
          .filter((e) => e.category === name)
          .reduce((n, e) => n + e.amountMinor, 0) / 100,
    }))
    .filter((d) => d.value);
  const byDay = new Map<string, number>();
  trip.expenses.forEach((e) =>
    byDay.set(e.date, (byDay.get(e.date) || 0) + e.amountMinor),
  );
  const daily = [...byDay]
    .sort()
    .map(([date, total]) => ({ date, total: total / 100 }));
  const compare = state.trips.map((t) => ({
    name: t.destination,
    total: t.expenses.reduce((n, e) => n + e.amountMinor, 0) / 100,
  }));
  return (
    <div className="chart-grid">
      {[
        [
          "支出分类",
          category.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={category}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={78}
                >
                  {category.map((v, i) => (
                    <Cell key={v.name} fill={colors[i % 6]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `¥${Number(v).toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="mini-empty">记下第一笔，看看钱花在哪儿。</p>
          ),
        ],
        [
          "每日花销（元）",
          daily.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(s) => s.slice(5)} />
                <YAxis width={50} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="实际支出"
                  stroke="#a58bb4"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="mini-empty">还没有实际支出趋势。</p>
          ),
        ],
        [
          "旅行花费对比（元）",
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={compare}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis width={50} />
              <Tooltip />
              <Bar
                dataKey="total"
                name="实际支出"
                fill="#d79b7d"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>,
        ],
      ].map(([title, chart]) => (
        <section className="panel p-5 min-w-0" key={String(title)}>
          <h3>{title}</h3>
          {chart}
        </section>
      ))}
    </div>
  );
}
