import { z } from 'zod';
export const guideSlotSchema=z.enum(['breakfast','morning','lunch','afternoon','tea','shopping','dinner','evening']);
export const recommendationDetailsSchema=z.object({
 reason:z.string().min(1).max(250),
 highlights:z.array(z.string().min(1).max(100)).min(1).max(5),
 transport:z.string().min(1).max(250),
 reservation:z.string().min(1).max(250),
 alternatives:z.array(z.string().min(1).max(150)).min(1).max(3),
 sources:z.array(z.object({platform:z.enum(['大众点评','大众点评必吃榜','米其林指南','本地特色']),query:z.string().min(1).max(150)}).strict()).max(4),
}).strict();
