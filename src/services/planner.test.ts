import { expect,it } from 'vitest';
import { mockPlan,planInputSchema,planSchema } from './planner';
const input={destination:'大理',days:5,travelers:4,budgetMinor:800000,pace:'relaxed' as const,interests:['自然风光']};
it('示例攻略符合严格结构，金额为整数分',()=>{const result=planSchema.parse(mockPlan(input));expect(result.days).toHaveLength(5);expect(result.days.every(d=>d.items.every(i=>Number.isInteger(i.costMinor)))).toBe(true);});
it('未知城市不捏造景点坐标',()=>expect(mockPlan({...input,destination:'未知城市'}).days[0].items[0].lat).toBeUndefined());
it('拒绝异常天数和无效金额',()=>{expect(()=>planInputSchema.parse({...input,days:99})).toThrow();expect(()=>planInputSchema.parse({...input,budgetMinor:0})).toThrow();});
it('拒绝额外字段及畸形模型输出',()=>{expect(()=>planSchema.parse({...mockPlan(input),secret:'x'})).toThrow();expect(()=>planSchema.parse({days:[]})).toThrow();});
