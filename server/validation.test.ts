import { describe,expect,it } from 'vitest';
import { seedState } from '../src/data/seed';
import { authorizeUpdate,validateTrip,visibleTrip } from './validation';
const trip=()=>seedState().trips[0];
describe('服务端旅行权限与输入边界',()=>{
 it('种子数据通过完整结构校验',()=>expect(validateTrip(trip()).expenses).toHaveLength(4));
 it('拒绝无权成员及只读成员',()=>{const old=trip();old.members.find(m=>m.id==='lin')!.role='viewer';const next={...old,version:2};expect(()=>authorizeUpdate(old,next,'outsider')).toThrow();expect(()=>authorizeUpdate(old,next,'lin')).toThrow();});
 it('编辑者不能修改他人账单和旅行角色',()=>{const old=trip();const next=structuredClone(old);next.version++;next.expenses[0].amountMinor++;expect(()=>authorizeUpdate(old,next,'lin')).toThrow();const other=structuredClone(old);other.version++;other.members[1].role='owner';expect(()=>authorizeUpdate(old,other,'lin')).toThrow();});
 it('编辑者可以增加与自己有关的账单',()=>{const old=trip(),next=visibleTrip(structuredClone(old),'lin');next.version++;next.expenses.push({...next.expenses[0],id:'own',idempotencyKey:'own',createdBy:'lin',payerId:'lin'});expect(authorizeUpdate(old,next,'lin').expenses).toHaveLength(5);});
 it('拒绝伪造作者、重复幂等键和篡改归属',()=>{const old=trip();const next=structuredClone(old);next.version++;next.expenses[0].createdBy='lin';expect(()=>authorizeUpdate(old,next,'me')).toThrow();const dup=trip();dup.expenses.push({...dup.expenses[0],id:'second'});expect(()=>validateTrip(dup)).toThrow();expect(()=>authorizeUpdate(old,{...old,version:2,ownerId:'lin'},'me')).toThrow();});
 it('个人清单不返回给其他成员，保存公共记录不丢失隐藏清单',()=>{const old=trip();const publicView=visibleTrip(old,'lin');expect(publicView.checklist.every(c=>!c.private)).toBe(true);const saved=authorizeUpdate(old,{...publicView,version:2},'lin');expect(saved.checklist).toHaveLength(old.checklist.length);});
 it('拒绝无效日期、浮点金额、重复记录和超额人数',()=>{for(const patch of [{startDate:'2026-02-30'},{budgetMinor:1.5},{members:Array(21).fill(trip().members[0])}])expect(()=>validateTrip({...trip(),...patch})).toThrow();});
 it('金额和参与成员在服务端校验',()=>{const t=trip();t.expenses[0].participantIds=['not-a-member'];expect(()=>validateTrip(t)).toThrow();t.expenses[0].participantIds=['me'];t.expenses[0].splitType='fixed';t.expenses[0].shares={me:1};expect(()=>validateTrip(t)).toThrow();});
});
