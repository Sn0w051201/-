import { expect,it } from 'vitest';
import { mockPlan,planInputSchema,planSchema } from './planner';
const input={destination:'大理',days:5,travelers:4,budgetMinor:800000,pace:'relaxed' as const,interests:['自然风光']};
it('示例攻略符合严格结构，金额为整数分',()=>{const result=planSchema.parse(mockPlan(input));expect(result.days).toHaveLength(5);expect(result.days.every(d=>d.items.every(i=>Number.isInteger(i.costMinor)))).toBe(true);});
it('未知城市不捏造景点坐标',()=>expect(mockPlan({...input,destination:'未知城市'}).days[0].items[0].lat).toBeUndefined());
it('拒绝异常天数和无效金额',()=>{expect(()=>planInputSchema.parse({...input,days:99})).toThrow();expect(()=>planInputSchema.parse({...input,budgetMinor:0})).toThrow();});
it('拒绝额外字段及畸形模型输出',()=>{expect(()=>planSchema.parse({...mockPlan(input),secret:'x'})).toThrow();expect(()=>planSchema.parse({days:[]})).toThrow();});
it('三城攻略每天覆盖三餐、茶歇、游玩和夜间活动，包含推荐理由和备选',()=>{
 for(const destination of ['大理','杭州','成都'])for(const pace of ['relaxed','balanced','packed'] as const){
  const plan=planSchema.parse(mockPlan({...input,destination,pace}));
  for(const day of plan.days){
   expect(day.items).toHaveLength(pace==='packed'?8:7);
   for(const slot of ['breakfast','morning','lunch','afternoon','tea','dinner','evening'])expect(day.items.some(a=>a.slot===slot)).toBe(true);
   for(const item of day.items){expect(item.details?.reason).toBeTruthy();expect(item.details?.highlights.length).toBeGreaterThan(0);expect(item.details?.transport).toBeTruthy();expect(item.details?.alternatives.length).toBeGreaterThan(0);}
   expect(day.items.reduce((n,a)=>n+a.costMinor,0)).toBeLessThanOrEqual(Math.floor(input.budgetMinor/input.days));
  }
 }
});
it('单日重生成按原行程日期偏移选择片区，不总回到第一天',()=>{const a=mockPlan({...input,days:1,dayOffset:0});const b=mockPlan({...input,days:1,dayOffset:1});expect(a.days[0].items.find(x=>x.slot==='morning')?.name).toBe('大理古城');expect(b.days[0].items.find(x=>x.slot==='morning')?.name).toBe('喜洲古镇');});
it('核验偏好用于来源入口，不伪造星级、评分或排名字段',()=>{const plan=mockPlan({...input,referencePreferences:['dianping','must-eat']});expect(plan.days[0].items[0].details?.sources.map(s=>s.platform)).toEqual(['大众点评','大众点评必吃榜']);expect(JSON.stringify(plan)).not.toMatch(/"(?:rating|rank|verified)":/);expect(plan.assumptions.join('')).toContain('不代表门店已上榜');});
it('用户提供的参考链接在本地不被伪装成已读取的数据',()=>{const plan=mockPlan({...input,references:'https://www.dianping.com/example 我收藏的店'});expect(plan.assumptions.join('')).toContain('本地演示不会读取链接');expect(()=>planInputSchema.parse({...input,references:'x'.repeat(1501)})).toThrow();});
it('小预算、多旅伴时估算仍为整数且不超过每日额度',()=>{for(const budgetMinor of [1,100,10001,9999999]){const plan=mockPlan({...input,budgetMinor,travelers:20,pace:'packed'});for(const day of plan.days)expect(day.items.reduce((n,a)=>n+a.costMinor,0)).toBeLessThanOrEqual(Math.floor(budgetMinor/input.days));}});
