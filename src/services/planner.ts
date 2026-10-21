import { detailedPlan } from '../data/guides';
import { cloudCall } from './cloud';
import { planInputSchema,planSchema } from '../domain/plan-schema';
export { planInputSchema,planSchema } from '../domain/plan-schema';
import type { GeneratedPlan, PlanInput } from '../domain/types';
export function mockPlan(input:PlanInput):GeneratedPlan {
  planInputSchema.parse(input);return detailedPlan(input);
}
export async function generatePlan(input:PlanInput):Promise<GeneratedPlan>{
  if(import.meta.env.VITE_DATA_MODE==='cloud'){
    return planSchema.parse(await cloudCall('generatePlan',{input}));
  }
  await new Promise(r=>setTimeout(r,1100));return planSchema.parse(mockPlan(input));
}
