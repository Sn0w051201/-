import type { Trip } from '../src/domain/types';
import { validateTrip } from '../src/domain/trip-schema';
export { validateTrip } from '../src/domain/trip-schema';
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function authorizeUpdate(previous:Trip,next:Trip,userId:string):Trip{
 const member=previous.members.find(m=>m.id===userId);
 if(!member||member.role==='viewer')throw new Error('没有修改此旅行的权限');
 if(next.id!==previous.id||next.ownerId!==previous.ownerId)throw new Error('不能更改旅行归属');
 if(next.version!==previous.version+1)throw new Error('版本无效，请刷新后重试');
 if(!same(next.members.map(m=>m.id),previous.members.map(m=>m.id)))throw new Error('成员必须通过邀请码加入，不能直接更改身份');
 if(member.role!=='owner'){
  for(const k of ['title','destination','startDate','budgetMinor','members'] as const)if(!same(previous[k],next[k]))throw new Error('只有创建者可以修改旅行信息或成员角色');
  for(const old of previous.expenses){const updated=next.expenses.find(e=>e.id===old.id);if(old.createdBy!==userId&&!same(old,updated))throw new Error('不能修改他人的账单');}
 }
 for(const e of next.expenses){const old=previous.expenses.find(x=>x.id===e.id);if(!old&&(e.createdBy!==userId||!e.participantIds.includes(userId)&&e.payerId!==userId))throw new Error('只能新增与自己有关的账单');if(old&&(e.createdBy!==old.createdBy||e.idempotencyKey!==old.idempotencyKey))throw new Error('不能改变账单作者或幂等标识');}
 const visible=previous.checklist.filter(c=>!c.private||c.createdBy===userId);const hidden=previous.checklist.filter(c=>c.private&&c.createdBy!==userId);
 if(next.checklist.some(c=>hidden.some(h=>h.id===c.id)))throw new Error('不能读取或覆盖他人的个人清单');
 for(const c of next.checklist){const old=visible.find(x=>x.id===c.id);if(!old&&c.createdBy!==userId)throw new Error('清单作者无效');if(old&&old.createdBy!==c.createdBy)throw new Error('不能改变清单作者');}
 return validateTrip({...next,checklist:[...next.checklist,...hidden]});
}
export const visibleTrip=(t:Trip,userId:string):Trip=>({...t,checklist:t.checklist.filter(c=>!c.private||c.createdBy===userId)});
