import { placeCandidateSchema } from "./local-advice";
import {
  travelProfileSchema,
  executionSchema,
  dayPracticalSchema,
  handbookBundleSchema,
  validateHandbook,
} from "./handbook-schema";
import {
  guideSlotSchema,
  recommendationDetailsSchema,
} from "./recommendation-schema";
import { z } from "zod";
import type { Trip } from "./types";
import { splitExpense } from "./money";
const id = z.string().min(1).max(100);
const minor = z.number().int().min(0).max(9999999999);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T12:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "日期无效");
const activity = z
  .object({
    place: placeCandidateSchema.optional(),
    execution: executionSchema.optional(),
    id,
    name: z.string().trim().min(1).max(100),
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
    costMinor: minor,
    note: z.string().max(500),
    address: z.string().max(200),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    done: z.boolean(),
    slot: guideSlotSchema.optional(),
    details: recommendationDetailsSchema.optional(),
  })
  .strict();
const member = z
  .object({
    id,
    name: z.string().trim().min(1).max(30),
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    role: z.enum(["owner", "editor", "viewer"]),
  })
  .strict();
const expense = z
  .object({
    estimateId: z.string().max(100).optional(),
    id,
    title: z.string().trim().min(1).max(60),
    amountMinor: minor.positive(),
    payerId: id,
    participantIds: z.array(id).min(1).max(20),
    splitType: z.enum(["equal", "ratio", "fixed"]),
    shares: z.record(z.number().int().nonnegative()),
    category: z.enum(["餐饮", "交通", "住宿", "门票", "购物", "其他"]),
    date,
    note: z.string().max(200),
    receipt: z
      .string()
      .max(1000000)
      .refine(
        (s) =>
          s.startsWith("cloud://") ||
          /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s),
        "凭证格式不正确",
      )
      .optional(),
    createdBy: id,
    idempotencyKey: id,
  })
  .strict();
const checklist = z
  .object({
    id,
    title: z.string().trim().min(1).max(100),
    category: z.enum(["物品", "待办", "预订"]),
    assigneeId: id,
    dueDate: z.union([date, z.literal("")]),
    private: z.boolean(),
    createdBy: id,
    done: z.boolean(),
  })
  .strict();
const photo = z
  .object({
    id,
    src: z
      .string()
      .max(700000)
      .refine(
        (v) =>
          v.startsWith("cloud://") ||
          /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v),
      ),
    caption: z.string().max(200),
    takenAt: date,
    createdBy: id,
  })
  .strict();
export const tripSchema = z
  .object({
    placeCandidates: z.array(placeCandidateSchema).max(12).optional(),
    handbook: handbookBundleSchema.optional(),
    travelProfile: travelProfileSchema.optional(),
    guideSummary: z.string().max(500).optional(),
    guideAssumptions: z.array(z.string().max(200)).max(10).optional(),
    photos: z.array(photo).max(30).optional(),
    visited: z.boolean().optional(),
    id,
    ownerId: id,
    title: z.string().trim().min(1).max(100),
    destination: z.string().trim().min(1).max(40),
    startDate: date,
    budgetMinor: minor.positive(),
    pace: z.enum(["relaxed", "balanced", "packed"]),
    interests: z.array(z.string().max(30)).max(10),
    members: z.array(member).min(1).max(20),
    days: z
      .array(
        z
          .object({
            practical: dayPracticalSchema.optional(),
            id,
            theme: z.string().min(1).max(100),
            items: z.array(activity).max(8),
          })
          .strict(),
      )
      .min(1)
      .max(14),
    expenses: z.array(expense).max(100),
    checklist: z.array(checklist).max(200),
    version: z.number().int().min(1),
    guideReferences: z.string().max(1500).optional(),
    referencePreferences: z
      .array(z.enum(["dianping", "must-eat", "michelin", "local"]))
      .max(4)
      .optional(),
    settledSignature: z.string().max(100000).optional(),
    cover: z.string().max(20),
  })
  .strict();
export function validateTrip(input: unknown, maxBytes = 900000): Trip {
  const t = tripSchema.parse(input);
  if (t.handbook) {
    validateHandbook(t.handbook);
  }
  const ids = t.members.map((m) => m.id);
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (
    !unique(ids) ||
    t.members.filter((m) => m.role === "owner").length !== 1 ||
    !t.members.some((m) => m.id === t.ownerId && m.role === "owner")
  )
    throw new Error("旅行创建者和成员配置不一致");
  if (
    !unique(t.days.map((d) => d.id)) ||
    !unique(t.days.flatMap((d) => d.items.map((a) => a.id))) ||
    !unique(t.expenses.map((e) => e.id)) ||
    !unique(t.expenses.map((e) => e.idempotencyKey)) ||
    !unique(t.checklist.map((c) => c.id)) ||
    !unique((t.photos || []).map((p) => p.id))
  )
    throw new Error("记录标识或幂等键重复");
  for (const e of t.expenses) {
    if (
      !ids.includes(e.payerId) ||
      !ids.includes(e.createdBy) ||
      e.participantIds.some((p) => !ids.includes(p))
    )
      throw new Error("账单包含无效成员");
    splitExpense(e);
  }
  for (const p of t.photos || [])
    if (!ids.includes(p.createdBy)) throw new Error("照片作者不是有效旅伴");
  for (const c of t.checklist)
    if (!ids.includes(c.assigneeId) || !ids.includes(c.createdBy))
      throw new Error("清单包含无效成员");
  if (new TextEncoder().encode(JSON.stringify(t)).length > maxBytes)
    throw new Error("旅行数据过大，请减少凭证或安排");
  return t;
}
