import {
  guideSlotSchema,
  recommendationDetailsSchema,
} from "./recommendation-schema";
import { z } from "zod";
export const planInputSchema = z
  .object({
    totalDays: z.number().int().min(1).max(14).optional(),
    adjustment: z.string().max(500).optional(),
    previousPlan: z.string().max(120000).optional(),
    destination: z.string().trim().min(1).max(40),
    days: z.number().int().min(1).max(14),
    travelers: z.number().int().min(1).max(20),
    budgetMinor: z.number().int().min(1).max(9999999999),
    pace: z.enum(["relaxed", "balanced", "packed"]),
    interests: z.array(z.string().max(30)).max(10),
    referencePreferences: z
      .array(z.enum(["dianping", "must-eat", "michelin", "local"]))
      .max(4)
      .optional(),
    references: z.string().max(1500).optional(),
    dayOffset: z.number().int().min(0).max(13).optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((v) => {
        const d = new Date(v + "T12:00:00Z");
        return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
      })
      .optional(),
    budgetMinMinor: z.number().int().min(0).max(9999999999).optional(),
  })
  .strict()
  .refine((v) => (v.budgetMinMinor ?? 0) <= v.budgetMinor, {
    message: "预算下限不能超过上限",
  })
  .refine(
    (v) =>
      v.totalDays === undefined || (v.dayOffset || 0) + v.days <= v.totalDays,
    { message: "请求日期超出旅行总天数" },
  );
export const planSchema = z
  .object({
    title: z.string().min(1).max(100),
    summary: z.string().max(500),
    assumptions: z.array(z.string().max(200)).max(10),
    days: z
      .array(
        z
          .object({
            theme: z.string().min(1).max(100),
            items: z
              .array(
                z
                  .object({
                    name: z.string().min(1).max(100),
                    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
                    duration: z.number().int().min(1).max(1440),
                    type: z.enum([
                      "attraction",
                      "food",
                      "transport",
                      "rest",
                      "hotel",
                      "shopping",
                      "nightlife",
                    ]),
                    costMinor: z.number().int().min(0).max(9999999999),
                    note: z.string().max(500),
                    address: z.string().max(200),
                    lat: z.number().min(-90).max(90).optional(),
                    lng: z.number().min(-180).max(180).optional(),
                    slot: guideSlotSchema.optional(),
                    details: recommendationDetailsSchema.optional(),
                  })
                  .strict(),
              )
              .min(1)
              .max(8),
          })
          .strict(),
      )
      .min(1)
      .max(14),
  })
  .strict();
