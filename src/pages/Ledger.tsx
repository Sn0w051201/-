import LedgerCharts from "../components/LedgerCharts";
import { estimatesFor } from "../domain/journey";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Coffee,
  Hotel,
  Image,
  LoaderCircle,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  Scale,
  ShieldCheck,
  Trash2,
  Wallet,
  X,
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
  SectionTitle,
} from "../components/UI";
import type { Expense, SplitType } from "../domain/types";
import { categories, uid } from "../domain/types";
import {
  ledgerSignature,
  money,
  parseMoney,
  settleExpenses,
  splitExpense,
} from "../domain/money";
import { cloudCall } from "../services/cloud";
const colors = [
  "#a58bb4",
  "#e6a282",
  "#86a995",
  "#8eafc5",
  "#d8bf8a",
  "#c9bdcf",
];
export default function Ledger() {
  const { trip, state, canEdit, isOwner, updateTrip, saving, notify, setView } =
    useMood();
  const [edit, setEdit] = useState<Expense | null | undefined>();
  const [category, setCategory] = useState("全部");
  const [settlement, setSettlement] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [receipt, setReceipt] = useState("");
  const [budget, setBudget] = useState(false);
  const estimates = estimatesFor(trip);
  const spent = trip.expenses.reduce((s, e) => s + e.amountMinor, 0);
  const ratio = trip.budgetMinor ? spent / trip.budgetMinor : 0;
  const { balances, transfers } = settleExpenses(trip.expenses, trip.members);
  const settled = trip.settledSignature === ledgerSignature(trip.expenses);
  const expenses = trip.expenses.filter(
    (e) => category === "全部" || e.category === category,
  );
  const showReceipt = async (e: Expense) => {
    if (!e.receipt) return;
    if (e.receipt.startsWith("cloud://")) {
      try {
        setReceipt(
          (await cloudCall("receiptUrl", {
            tripId: trip.id,
            expenseId: e.id,
          })) as string,
        );
      } catch (err) {
        notify((err as Error).message, "error");
      }
    } else setReceipt(e.receipt);
  };
  return (
    <div className="fade-in">
      <PageHeading
        eyebrow="GOOD TIMES, CLEAR ACCOUNTS"
        title="一起花，也一起算清楚"
        description="把账记明白，把快乐留给旅途。"
        action={
          <Button disabled={!canEdit} onClick={() => setEdit(null)}>
            <Plus size={17} />
            记一笔
          </Button>
        }
      />
      <div className="context-line">
        <span className="context-dot" />
        {trip.title}
        <span className="pill pill-neutral">
          {trip.members.length} 位旅伴 · 人民币
        </span>
      </div>
      <div className="ledger-stats">
        <section className="panel budget-panel">
          <div>
            <span className="subtle">旅行总预算</span>
            <strong className="large-money">
              <small>¥</small>
              {money(trip.budgetMinor)}
            </strong>
            <div className="budget-track">
              <span
                style={{
                  width: `${Math.min(ratio * 100, 100)}%`,
                  background: ratio > 1 ? "#c66b5c" : undefined,
                }}
              />
            </div>
            <p>
              {ratio > 1 ? "预算已超出" : "预算已使用"}{" "}
              <strong>{(ratio * 100).toFixed(1)}%</strong>
              <span>
                {ratio > 1 ? "超支" : "剩余"} ¥
                {money(Math.abs(trip.budgetMinor - spent))}
              </span>
            </p>
          </div>
          <div
            className="budget-ring"
            style={{
              background: `conic-gradient(${ratio > 1 ? "#c66b5c" : "#9579a7"} ${Math.min(ratio * 100, 100)}%,#eee8f2 0)`,
            }}
          >
            <div>
              <Wallet size={23} />
              <small>安心出发</small>
            </div>
          </div>
        </section>
        <section className="panel ledger-number">
          <span className="stat-icon orange">
            <ReceiptText size={21} />
          </span>
          <p>已记录支出</p>
          <strong>
            <small>¥ </small>
            {money(spent)}
          </strong>
          <span>{trip.expenses.length} 笔旅途小记</span>
        </section>
        <section className="panel ledger-number">
          <span className="stat-icon green">
            <Scale size={21} />
          </span>
          <p>人均支出</p>
          <strong>
            <small>¥ </small>
            {money(Math.floor(spent / (trip.members.length || 1)), 2)}
          </strong>
          <span>总支出 ÷ 全部旅伴，仅作参考</span>
        </section>
      </div>
      <LedgerCharts />
      <section className="panel p-5 my-5">
        <div className="flex justify-between gap-3">
          <h3>预算与行程费用预估</h3>
          <Button
            variant="secondary"
            disabled={!isOwner}
            onClick={() => setBudget(true)}
          >
            调整预算
          </Button>
        </div>
        <p>
          {ratio >= 1
            ? "已超预算，请调整安排或提高预算。"
            : ratio >= 0.8
              ? "预算已使用超过 80%，请关注剩余额度。"
              : "预算充裕，按自己的节奏出发。"}{" "}
          剩余每日可花约 ¥
          {money(
            Math.floor(
              Math.max(0, trip.budgetMinor - spent) /
                Math.max(1, trip.days.length),
            ),
          )}
        </p>
        <p>
          行程预估共 ¥{money(estimates.reduce((n, e) => n + e.amountMinor, 0))}
          ，用于规划，未计入实际支出或 AA。
        </p>
        <details>
          <summary>查看预估项目 · 点击记账后请填写实际消费金额</summary>
          {estimates.map((e) => (
            <div className="estimate-row" key={e.id}>
              <span>
                {e.date.slice(5)} · {e.title}
              </span>
              <strong>¥{money(e.amountMinor)}</strong>
              <Button
                variant="secondary"
                disabled={
                  !canEdit || trip.expenses.some((x) => x.estimateId === e.id)
                }
                onClick={() =>
                  setEdit({
                    id: uid(),
                    estimateId: e.id,
                    title: e.title.slice(0, 60),
                    amountMinor: e.amountMinor,
                    category: e.category,
                    date: e.date,
                    payerId: state.userId,
                    participantIds: trip.members.map((m) => m.id),
                    splitType: "equal",
                    shares: {},
                    note: "请核对实际金额",
                    createdBy: state.userId,
                    idempotencyKey: uid(),
                  })
                }
              >
                {trip.expenses.some((x) => x.estimateId === e.id)
                  ? "已记账"
                  : "记实际花费"}
              </Button>
            </div>
          ))}
        </details>
      </section>
      <div className="ledger-layout">
        <section className="panel expense-panel">
          <SectionTitle
            title="每一笔，都有好故事"
            action={
              <Button variant="secondary" onClick={() => setSettlement(true)}>
                <Scale size={15} />
                AA 分账
              </Button>
            }
          />
          <div className="expense-filters">
            {["全部", ...categories].map((c) => (
              <button
                key={c}
                className={category === c ? "selected" : ""}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          {expenses.length ? (
            <div className="expense-list">
              {[...expenses].reverse().map((e) => (
                <div className="expense-row" key={e.id}>
                  <span
                    className={`stat-icon ${e.category === "餐饮" ? "orange" : e.category === "住宿" ? "purple" : "green"}`}
                  >
                    {e.category === "餐饮" ? (
                      <Coffee size={20} />
                    ) : e.category === "住宿" ? (
                      <Hotel size={20} />
                    ) : (
                      <ReceiptText size={20} />
                    )}
                  </span>
                  <div className="expense-name">
                    <h3>{e.title}</h3>
                    <p>
                      {e.date.slice(5).replace("-", "月")}日 <span>·</span>
                      {trip.members.find((m) => m.id === e.payerId)?.name} 付款
                      <span>·</span>
                      {e.participantIds.length} 人分摊
                    </p>
                    {e.note && <small>{e.note}</small>}
                  </div>
                  <div className="expense-amount">
                    <strong>¥{money(e.amountMinor, 2)}</strong>
                    <span>{e.category}</span>
                  </div>
                  <div className="expense-actions">
                    {e.receipt && (
                      <IconButton
                        label={`查看${e.title}凭证`}
                        onClick={() => void showReceipt(e)}
                      >
                        <Paperclip size={15} />
                      </IconButton>
                    )}
                    <IconButton
                      label={`编辑${e.title}`}
                      disabled={
                        !canEdit || (!isOwner && e.createdBy !== state.userId)
                      }
                      onClick={() => setEdit(e)}
                    >
                      <Pencil size={15} />
                    </IconButton>
                    <IconButton
                      label={`删除${e.title}`}
                      disabled={
                        !canEdit || (!isOwner && e.createdBy !== state.userId)
                      }
                      onClick={() => setDeleting(e)}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="还没有这类支出"
              description="一杯咖啡、一顿晚餐，都可以成为旅途的记录。"
              action={
                <Button disabled={!canEdit} onClick={() => setEdit(null)}>
                  记下第一笔
                </Button>
              }
            />
          )}
        </section>
        <aside className="ledger-aside">
          <section className="panel category-panel">
            <SectionTitle title="钱都花在哪儿了" />
            {categories.map((c, i) => {
              const total = trip.expenses
                .filter((e) => e.category === c)
                .reduce((s, e) => s + e.amountMinor, 0);
              return (
                <div className="category-line" key={c}>
                  <div>
                    <span>
                      <i style={{ background: colors[i] }} />
                      {c}
                    </span>
                    <strong>¥{money(total)}</strong>
                  </div>
                  <div className="category-track">
                    <span
                      style={{
                        width: `${spent ? (total / spent) * 100 : 0}%`,
                        background: colors[i],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </section>
          <section className="settlement-teaser">
            <span className="stat-icon purple">
              <ShieldCheck size={23} />
            </span>
            <h3>感情不算账，账要算清楚。</h3>
            <p>
              精确到分，按稳定规则分摊。
              <br />
              只生成转账建议，不发生真实支付。
            </p>
            <Button onClick={() => setSettlement(true)}>
              看看怎么分
              <ArrowRight size={16} />
            </Button>
          </section>
        </aside>
      </div>
      {budget && (
        <Modal title="调整旅行总预算" onClose={() => setBudget(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const amount = parseMoney(
                  String(new FormData(e.currentTarget).get("budget")),
                );
                if (amount <= 0) throw new Error("预算需要大于零");
                if (await updateTrip((t) => ({ ...t, budgetMinor: amount })))
                  setBudget(false);
              } catch (e) {
                notify((e as Error).message, "error");
              }
            }}
          >
            <Field label="总预算（元）">
              <input
                name="budget"
                defaultValue={trip.budgetMinor / 100}
                required
              />
            </Field>
            <Button type="submit">保存预算</Button>
          </form>
        </Modal>
      )}
      {edit !== undefined && (
        <ExpenseForm expense={edit} onClose={() => setEdit(undefined)} />
      )}
      {settlement && (
        <Modal
          title="让每一分钱，都刚刚好"
          description="基于已记录账单生成的简化转账建议，不是支付操作。"
          onClose={() => setSettlement(false)}
        >
          <div className="balance-list">
            {trip.members.map((m) => (
              <div className="member-row" key={m.id}>
                <Avatar member={m} />
                <strong>{m.name}</strong>
                <span
                  className={balances[m.id] > 0 ? "balance-positive" : "subtle"}
                >
                  {balances[m.id] > 0
                    ? "应收"
                    : balances[m.id] < 0
                      ? "应付"
                      : "已平衡"}{" "}
                  {balances[m.id] !== 0
                    ? `¥${money(Math.abs(balances[m.id]), 2)}`
                    : ""}
                </span>
              </div>
            ))}
          </div>
          <h3 className="modal-subheading">
            {settled ? "已记录全员结清" : "建议这样转账"}
          </h3>
          {transfers.map((t, i) => (
            <div className="transfer-row" key={i}>
              <span>{trip.members.find((m) => m.id === t.from)?.name}</span>
              <ArrowRight size={16} />
              <span>{trip.members.find((m) => m.id === t.to)?.name}</span>
              <strong>¥{money(t.amountMinor, 2)}</strong>
            </div>
          ))}
          {!transfers.length && (
            <p className="mini-empty">没有待结算金额，大家已经平衡。</p>
          )}
          <p className="form-note">
            “记录结清”只保存当前账单的确认状态；新增、修改或删除账单后需重新确认。不代表已经完成真实转账。
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setSettlement(false)}>
              稍后处理
            </Button>
            <Button
              disabled={!canEdit || settled || !transfers.length}
              onClick={async () => {
                if (
                  await updateTrip((t) => ({
                    ...t,
                    settledSignature: ledgerSignature(t.expenses),
                  }))
                )
                  notify("已记录当前账单全部结清，不涉及真实支付");
              }}
            >
              <Check size={16} />
              {settled ? "已记录结清" : "记录全员结清"}
            </Button>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="删除这笔支出？"
          description={`${deleting.title} · ¥${money(deleting.amountMinor, 2)}。删除后会重新计算预算与分账。`}
          onClose={() => setDeleting(null)}
        >
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              保留
            </Button>
            <Button
              disabled={saving}
              onClick={async () => {
                if (
                  await updateTrip((t) => ({
                    ...t,
                    expenses: t.expenses.filter((e) => e.id !== deleting.id),
                  }))
                ) {
                  setDeleting(null);
                  notify("支出已删除，分账已更新");
                }
              }}
            >
              确认删除
            </Button>
          </div>
        </Modal>
      )}
      {receipt && (
        <Modal title="消费凭证" onClose={() => setReceipt("")}>
          <img
            className="receipt-image"
            src={receipt}
            alt="用户上传的消费凭证"
          />
        </Modal>
      )}
    </div>
  );
}
function ExpenseForm({
  expense,
  onClose,
}: {
  expense: Expense | null;
  onClose: () => void;
}) {
  const { trip, state, updateTrip, saving, notify, cloud } = useMood();
  const [participants, setParticipants] = useState(
    expense?.participantIds || trip.members.map((m) => m.id),
  );
  const [splitType, setSplitType] = useState<SplitType>(
    expense?.splitType || "equal",
  );
  const [amount, setAmount] = useState(
    expense ? String(expense.amountMinor / 100) : "",
  );
  const [shares, setShares] = useState<Record<string, string>>(
    Object.fromEntries(
      trip.members.map((m) => [
        m.id,
        expense?.shares[m.id] !== undefined
          ? String(
              expense.splitType === "fixed"
                ? expense.shares[m.id] / 100
                : expense.shares[m.id],
            )
          : "1",
      ]),
    ),
  );
  const [receipt, setReceipt] = useState(expense?.receipt || "");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [requestId] = useState(expense?.idempotencyKey || uid());
  const compute = () => {
    const amountMinor = parseMoney(amount);
    const values = Object.fromEntries(
      participants.map((id) => [
        id,
        splitType === "fixed"
          ? parseMoney(shares[id] || "0")
          : Number(shares[id] || "1"),
      ]),
    );
    return {
      amountMinor,
      shares: values,
      allocation: splitExpense({
        amountMinor,
        participantIds: participants,
        splitType,
        shares: values,
      }),
    };
  };
  let preview: Record<string, number> = {};
  try {
    preview = compute().allocation;
  } catch {
    /* show validation on submit */
  }
  const readFile = async (file: File) => {
    setError("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("请使用 5MB 以下的 JPG、PNG 或 WebP 图片");
      return;
    }
    setReading(true);
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas
        .getContext("2d")!
        .drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close();
      const data = canvas.toDataURL("image/jpeg", 0.72);
      if (data.length > 1000000)
        throw new Error("压缩后的图片仍过大，请选择更小的凭证");
      setReceipt(
        cloud
          ? ((await cloudCall("uploadReceipt", {
              tripId: trip.id,
              data,
            })) as string)
          : data,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  };
  return (
    <Modal
      title={expense ? "编辑这笔旅途小记" : "今天，为快乐花了多少？"}
      description="金额以整数分保存，多一分、少一分都认真对待。"
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const { amountMinor, shares: values } = compute();
            const title = String(f.get("title")).trim();
            if (!title) throw new Error("请填写支出名称");
            const next: Expense = {
              ...(expense?.estimateId
                ? { estimateId: expense.estimateId }
                : {}),
              id: expense?.id || uid(),
              idempotencyKey: requestId,
              title,
              amountMinor,
              payerId: String(f.get("payer")),
              participantIds: participants,
              splitType,
              shares: values,
              category: String(f.get("category")) as Expense["category"],
              date: String(f.get("date")),
              note: String(f.get("note")),
              createdBy: expense?.createdBy || state.userId,
              ...(receipt ? { receipt } : {}),
            };
            const ok = await updateTrip((t) => ({
              ...t,
              expenses:
                expense && t.expenses.some((x) => x.id === expense.id)
                  ? t.expenses.map((x) => (x.id === expense.id ? next : x))
                  : t.expenses.some((x) => x.idempotencyKey === requestId)
                    ? t.expenses
                    : [...t.expenses, next],
            }));
            if (ok) {
              notify("这笔小记已保存，分账与预算已更新");
              onClose();
            }
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <Field label="支出名称">
          <input
            name="title"
            required
            maxLength={60}
            defaultValue={expense?.title}
            placeholder="例如：一起吃的第一顿晚餐"
            autoFocus
          />
        </Field>
        <div className="form-row">
          <Field label="金额（元）">
            <input
              name="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </Field>
          <Field label="消费分类">
            <select name="category" defaultValue={expense?.category || "餐饮"}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="谁先付的钱">
            <select
              name="payer"
              defaultValue={expense?.payerId || state.userId}
            >
              {trip.members.map((m) => (
                <option value={m.id} key={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="消费日期">
            <input
              name="date"
              type="date"
              defaultValue={expense?.date || trip.startDate}
              required
            />
          </Field>
        </div>
        <Field label="一起分摊的旅伴">
          <div className="participant-pills">
            {trip.members.map((m) => (
              <button
                className={participants.includes(m.id) ? "selected" : ""}
                type="button"
                key={m.id}
                onClick={() =>
                  setParticipants(
                    participants.includes(m.id)
                      ? participants.filter((x) => x !== m.id)
                      : [...participants, m.id],
                  )
                }
              >
                {participants.includes(m.id) && <Check size={13} />} {m.name}
              </button>
            ))}
          </div>
        </Field>
        <Field label="怎么分摊">
          <select
            value={splitType}
            onChange={(e) => setSplitType(e.target.value as SplitType)}
          >
            <option value="equal">平均分摊</option>
            <option value="ratio">按自定义比例</option>
            <option value="fixed">指定每人金额</option>
          </select>
        </Field>
        <div className="split-preview">
          {participants.map((id) => (
            <div className="split-member" key={id}>
              <span>{trip.members.find((m) => m.id === id)?.name}</span>
              {splitType !== "equal" && (
                <input
                  aria-label={`${trip.members.find((m) => m.id === id)?.name}${splitType === "ratio" ? "的比例" : "的分摊金额"}`}
                  inputMode={splitType === "ratio" ? "numeric" : "decimal"}
                  value={shares[id] || ""}
                  onChange={(e) =>
                    setShares({ ...shares, [id]: e.target.value })
                  }
                  placeholder={splitType === "ratio" ? "份额" : "元"}
                />
              )}
              <strong>¥{money(preview[id] || 0, 2)}</strong>
            </div>
          ))}
        </div>
        <Field label="备注（选填）">
          <input
            name="note"
            maxLength={200}
            defaultValue={expense?.note}
            placeholder="给这笔花费留一点小记忆"
          />
        </Field>
        <div className="receipt-upload">
          <label>
            <Paperclip size={16} />
            {reading
              ? "正在处理图片…"
              : receipt
                ? "更换消费凭证"
                : "添加消费凭证（选填）"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={reading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
              }}
            />
          </label>
          {receipt && (
            <button
              type="button"
              onClick={() => setReceipt("")}
              aria-label="移除凭证"
            >
              <X size={15} />
            </button>
          )}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            取消
          </Button>
          <Button disabled={saving || reading} type="submit">
            {saving && <LoaderCircle size={15} className="spin" />}保存支出
          </Button>
        </div>
      </form>
    </Modal>
  );
}
