import type { Expense, Member } from './types';

export const money = (minor: number, digits = 0) => new Intl.NumberFormat('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: 2 }).format(minor / 100);
export function parseMoney(value: string): number {
  if (!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(value.trim())) throw new Error('请输入最多两位小数的有效金额');
  const [whole, fraction = ''] = value.trim().split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
const compareId = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function splitExpense(expense: Pick<Expense, 'amountMinor' | 'participantIds' | 'splitType' | 'shares'>): Record<string, number> {
  const { amountMinor, splitType, shares } = expense;
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 1 || amountMinor > 9999999999) throw new Error('金额须为有效的整数分');
  const ids = [...expense.participantIds].sort(compareId);
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error('请选择不重复的参与成员');
  if (splitType === 'fixed') {
    if (ids.some(id => !Number.isSafeInteger(shares[id]) || shares[id] < 0) || ids.reduce((sum, id) => sum + shares[id], 0) !== amountMinor) throw new Error('指定金额之和必须等于账单总额');
    return Object.fromEntries(ids.map(id => [id, shares[id]]));
  }
  if (splitType !== 'equal' && splitType !== 'ratio') throw new Error('不支持的分摊方式');
  const weights = ids.map(id => splitType === 'equal' ? 1 : shares[id]);
  if (weights.some(w => !Number.isSafeInteger(w) || w < 1 || w > 1000000)) throw new Error('比例须为 1 至 1000000 的整数');
  const total = weights.reduce((sum, w) => sum + BigInt(w), 0n);
  const ranked = ids.map((id, i) => {
    const product = BigInt(amountMinor) * BigInt(weights[i]);
    return { id, amount: Number(product / total), remainder: product % total };
  });
  let remaining = amountMinor - ranked.reduce((sum, x) => sum + x.amount, 0);
  const order = [...ranked].sort((a, b) => a.remainder === b.remainder ? compareId(a.id, b.id) : a.remainder > b.remainder ? -1 : 1);
  for (const item of order) { if (remaining-- <= 0) break; item.amount++; }
  return Object.fromEntries(ranked.map(x => [x.id, x.amount]));
}
export function settleExpenses(expenses: Expense[], members: Pick<Member, 'id'>[]) {
  const balances = Object.fromEntries(members.map(m => [m.id, 0]));
  const seen = new Set<string>();
  for (const expense of expenses) {
    if (seen.has(expense.idempotencyKey)) continue;
    seen.add(expense.idempotencyKey);
    if (!(expense.payerId in balances) || expense.participantIds.some(id => !(id in balances))) throw new Error('账单包含不属于旅行的成员');
    balances[expense.payerId] += expense.amountMinor;
    for (const [id, amount] of Object.entries(splitExpense(expense))) balances[id] -= amount;
  }
  if (Object.values(balances).reduce((a, b) => a + b, 0) !== 0) throw new Error('账单金额不守恒');
  const order = (a: { id: string; amount: number }, b: { id: string; amount: number }) => b.amount - a.amount || compareId(a.id, b.id);
  const debtors = Object.entries(balances).filter(([, n]) => n < 0).map(([id, n]) => ({ id, amount: -n })).sort(order);
  const creditors = Object.entries(balances).filter(([, n]) => n > 0).map(([id, amount]) => ({ id, amount })).sort(order);
  const transfers: { from: string; to: string; amountMinor: number }[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amountMinor = Math.min(debtors[i].amount, creditors[j].amount);
    transfers.push({ from: debtors[i].id, to: creditors[j].id, amountMinor });
    debtors[i].amount -= amountMinor; creditors[j].amount -= amountMinor;
    if (!debtors[i].amount) i++;
    if (!creditors[j].amount) j++;
  }
  return { balances, transfers };
}
export function ledgerSignature(expenses: Expense[]): string {
  return JSON.stringify(expenses.map(e => [e.id, e.amountMinor, e.payerId, [...e.participantIds].sort(), e.splitType, Object.entries(e.shares).sort()]).sort((a, b) => compareId(String(a[0]), String(b[0]))));
}
