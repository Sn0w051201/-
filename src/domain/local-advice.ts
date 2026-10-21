import { z } from "zod";
export const localStyles = ["当地特色", "网红店", "宝藏小店"] as const;
const text = z.string().trim().min(1).max(180);
const https = z
  .string()
  .url()
  .max(500)
  .refine((s) => {
    try {
      const u = new URL(s);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "来源链接须使用HTTPS");
export function isDianpingURL(value: string) {
  try {
    return /^(?:[a-z0-9-]+\.)*(?:dianping\.com|dpurl\.cn)$/i.test(
      new URL(value).hostname,
    );
  } catch {
    return false;
  }
}
export const placeCandidateSchema = z
  .object({
    id: z.string().min(1).max(100),
    category: z.enum(["food", "play"]),
    name: z.string().trim().min(1).max(100),
    fullAddress: z.string().trim().max(300),
    source: z.enum(["大众点评", "官方资料", "个人记录"]),
    sourceUrl: z.union([https, z.literal("")]),
    sourceNote: z.string().trim().min(1).max(200),
    observedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((v) => {
        const d = new Date(v + "T12:00:00Z");
        return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
      }),
    avgPriceMinor: z.number().int().min(0).max(999999999).nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.source === "大众点评" &&
      (!v.sourceUrl || !isDianpingURL(v.sourceUrl))
    )
      ctx.addIssue({
        code: "custom",
        message: "请提供大众点评或点评短链的HTTPS门店链接",
      });
  });
export type PlaceCandidate = z.infer<typeof placeCandidateSchema>;
export const localPreferencesSchema = z
  .object({
    styles: z.array(z.enum(localStyles)).max(3),
    foodTypes: z.array(z.string().max(25)).max(8),
    playTypes: z.array(z.string().max(25)).max(8),
    area: z.string().max(150),
    maxPerPersonMinor: z.number().int().min(0).max(999999999).nullable(),
    queueToleranceMinutes: z.number().int().min(0).max(180),
    reservation: z.enum(["any", "avoid", "okay"]),
  })
  .strict();
export const localAdviceSchema = z
  .object({
    candidateId: z.string().max(100).nullable(),
    styles: z.array(z.enum(localStyles)).min(1).max(3),
    mustTry: z.array(text).min(1).max(4),
    playTips: z.array(text).min(1).max(4),
    avoidTips: z.array(text).min(1).max(3),
    hoursTip: text,
    queueTip: text,
    reservationTip: text,
    suitableFor: text,
  })
  .strict();
export const groundedPlaceSchema = placeCandidateSchema;
export type LocalAdvice = z.infer<typeof localAdviceSchema>;
export type LocalPreferences = z.infer<typeof localPreferencesSchema>;
export function completePlaceAddress(address: string) {
  return (
    /(?:省|自治区|市|特别行政区)/.test(address) &&
    /(?:区|县|旗)/.test(address) &&
    /(?:路|街|巷|道|弄)/.test(address) &&
    /[0-9０-９一二三四五六七八九十百]+\s*(?:号|层|楼|室)/.test(address)
  );
}
export function placeCopyText(name: string, address: string) {
  return completePlaceAddress(address)
    ? `店铺 / 场所名称：${name}\n地址：${address}\n【需出发前核实】`
    : `店铺 / 场所名称：${name}\n暂无完整地址，请复制店名搜索【需核实】`;
}
export function placeNavigationURL(name: string, address: string) {
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(name + " " + address)}`;
}
