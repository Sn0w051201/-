import { z } from "zod";
const safePhoto = z
  .string()
  .url()
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  });
export const destinationSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(40),
    region: z.string().max(40),
    country: z.string().min(1).max(40),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    months: z.array(z.number().int().min(1).max(12)).min(1).max(12),
    days: z
      .tuple([z.number().int().min(1).max(30), z.number().int().min(1).max(30)])
      .refine(([a, b]) => a <= b),
    budgetMinor: z
      .tuple([z.number().int().min(0), z.number().int().min(1)])
      .refine(([a, b]) => a <= b),
    themes: z.array(z.string().max(20)).max(8),
    tagline: z.string().max(120),
    highlights: z.array(z.string().max(200)).max(12),
    foods: z.array(z.string().max(100)).max(12),
    routes: z.array(z.string().max(300)).max(8),
    tips: z.array(z.string().max(300)).max(10),
    photo: z.union([
      safePhoto,
      z.string().regex(/^images\/discover\/[a-z]+\.jpg$/),
    ]),
    photoSource: safePhoto,
  })
  .strict();
