import { describe, expect, it } from 'vitest';
import { parseMoney, settleExpenses, splitExpense } from './money';
import type { Expense } from './types';
const bill = (patch: Partial<Expense> = {}): Expense => ({ id: 'e1', title: '午餐', amountMinor: 10000, payerId: 'a', participantIds: ['a','b','c'], splitType: 'equal', shares: {}, category: '餐饮', date: '2026-10-21', note: '', createdBy: 'a', idempotencyKey: 'e1', ...patch });
describe('整数金额与确定性分账', () => {
  it('精确解析金额，不引入浮点计算', () => { expect(parseMoney('0.01')).toBe(1); expect(parseMoney('100.10')).toBe(10010); expect(() => parseMoney('1.001')).toThrow(); expect(() => parseMoney('-1')).toThrow(); expect(() => parseMoney('1e3')).toThrow(); });
  it('平均分按稳定 ID 分配余数，与输入顺序无关', () => { expect(splitExpense(bill())).toEqual({ a:3334,b:3333,c:3333 }); expect(splitExpense(bill({participantIds:['c','b','a']}))).toEqual(splitExpense(bill())); });
  it('只给指定成员分摊', () => expect(splitExpense(bill({ participantIds: ['b','c'] }))).toEqual({b:5000,c:5000}));
  it('一分钱多人分摊仍守恒', () => expect(splitExpense(bill({amountMinor:1}))).toEqual({a:1,b:0,c:0}));
  it('按比例使用最大余数法及稳定 ID', () => expect(splitExpense(bill({amountMinor:100,splitType:'ratio',shares:{a:1,b:2,c:3}}))).toEqual({a:17,b:33,c:50}));
  it('自定义金额严格验和', () => { expect(splitExpense(bill({splitType:'fixed',shares:{a:1000,b:4000,c:5000}}))).toEqual({a:1000,b:4000,c:5000}); expect(()=>splitExpense(bill({splitType:'fixed',shares:{a:1,b:2,c:3}}))).toThrow(); });
  it('拒绝无成员、重复成员、无效金额与比例', () => { for (const patch of [{ participantIds:[] },{ participantIds:['a','a'] },{amountMinor:1.1},{splitType:'ratio' as const,shares:{a:0,b:1,c:1}}]) expect(()=>splitExpense(bill(patch))).toThrow(); });
  it('多人欠款结算并保留一分钱', () => { const result=settleExpenses([bill({amountMinor:30001})],[{id:'a'},{id:'b'},{id:'c'}]); expect(result.transfers).toEqual([{from:'b',to:'a',amountMinor:10000},{from:'c',to:'a',amountMinor:10000}]); expect(settleExpenses([bill({amountMinor:2,participantIds:['a','b']})],[{id:'a'},{id:'b'}]).transfers[0].amountMinor).toBe(1); });
  it('多个付款人、指定参与人和重复提交', () => { const bills=[bill(),bill({id:'e2',idempotencyKey:'e2',payerId:'b',amountMinor:6000,participantIds:['a','c']})]; const result=settleExpenses([...bills,bills[0]],[{id:'a'},{id:'b'},{id:'c'}]); expect(result.balances).toEqual({a:3666,b:2667,c:-6333}); expect(result.transfers.reduce((n,t)=>n+t.amountMinor,0)).toBe(6333); });
  it('五人一百笔账单：总额守恒，清算后全部归零', () => { const members=Array.from({length:5},(_,i)=>({id:String(i)})); const bills=Array.from({length:100},(_,i)=>bill({id:String(i),idempotencyKey:String(i),amountMinor:101+i,payerId:String(i%5),participantIds:members.map(m=>m.id)})); const {balances,transfers}=settleExpenses(bills,members); const after={...balances}; for(const t of transfers){after[t.from]+=t.amountMinor;after[t.to]-=t.amountMinor;expect(Number.isSafeInteger(t.amountMinor)).toBe(true);} expect(Object.values(after).every(n=>n===0)).toBe(true); expect(settleExpenses([...bills].reverse(),[...members].reverse()).transfers).toEqual(transfers); });
});
