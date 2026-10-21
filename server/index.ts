import cloudbase from "@cloudbase/node-sdk";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import type { AppState, Trip } from "../src/domain/types";
import { authorizeUpdate, validateTrip, visibleTrip } from "./validation";
import { generateWithProvider } from "./llm";
import { makeSnapshot, shareSchema } from "../src/services/sharing";
import { planInputSchema } from "../src/domain/plan-schema";
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
type Transaction = Pick<typeof db, "collection">;
const first = (r: { data: unknown }) =>
  Array.isArray(r.data) ? r.data[0] : r.data;
const token = () => randomBytes(24).toString("base64url");
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const get = async (collection: string, id: string) =>
  first(await db.collection(collection).doc(id).get());
async function requireTrip(id: string, userId: string) {
  const t = (await get("trips", id)) as Trip | undefined;
  if (!t || !t.members.some((m) => m.id === userId))
    throw new Error("旅行不存在或没有访问权限");
  return t;
}
async function requireOwner(id: string, userId: string) {
  const t = await requireTrip(id, userId);
  if (t.ownerId !== userId) throw new Error("只有创建者可以执行此操作");
  return t;
}
async function allTrips(userId: string) {
  const records: Trip[] = [];
  let offset = 0;
  for (;;) {
    const result = await db
      .collection("trips")
      .where({ memberIds: userId })
      .skip(offset)
      .limit(50)
      .get();
    records.push(...(result.data as unknown as Trip[]));
    if (result.data.length < 50) break;
    offset += 50;
    if (offset >= 1000) throw new Error("旅行数量超出 MVP 范围");
  }
  return records;
}
// SDK metadata is stripped before passing data to the strict schema.
function cleanTrip(raw: Trip & { _id?: unknown; memberIds?: unknown }) {
  const { _id, memberIds, ...t } = raw;
  return t as Trip;
}
export async function main(event: Record<string, unknown>) {
  try {
    const userId = app.auth().getUserInfo().uid;
    if (!userId) throw new Error("请先登录");
    const action = z.string().parse(event.action);
    if (action === "getShare") {
      const code = z
        .string()
        .regex(/^[A-Za-z0-9_-]{32}$/)
        .parse(event.token);
      const row = (await get("shares", hash(code))) as
        { snapshot: unknown; expiresAt: number; revoked: boolean } | undefined;
      if (!row || row.revoked || row.expiresAt < Date.now())
        throw new Error("分享已过期或被撤销");
      return { ok: true, data: shareSchema.parse(row.snapshot) };
    }
    if (action === "bootstrap") {
      let user = (await get("users", userId)) as { name: string } | undefined;
      if (!user) {
        user = { name: "新旅人" };
        await db
          .collection("users")
          .doc(userId)
          .set({ ...user, createdAt: Date.now() });
      }
      const trips = (await allTrips(userId)).map((t) =>
        visibleTrip(cleanTrip(t), userId),
      );
      const state: AppState = {
        schemaVersion: 1,
        userId,
        profile: { name: user.name },
        trips,
        activeTripId: trips[0]?.id || "",
      };
      return { ok: true, data: state };
    }
    if (action === "updateProfile") {
      const name = z.string().trim().min(1).max(16).parse(event.name);
      await db.collection("users").doc(userId).update({ name });
      return { ok: true, data: { name } };
    }
    if (action === "createTrip") {
      const proposed = validateTrip(event.trip);
      if (
        proposed.ownerId !== userId ||
        proposed.members[0]?.id !== userId ||
        proposed.expenses.length ||
        proposed.checklist.some((c) => c.createdBy !== userId)
      )
        throw new Error("新旅行身份或初始数据无效");
      const count = await db
        .collection("trips")
        .where({ ownerId: userId })
        .count();
      if (count.total >= 100) throw new Error("最多创建 100 场旅行");
      const t = {
        ...proposed,
        id: randomBytes(16).toString("hex"),
        version: 1,
      };
      await db
        .collection("trips")
        .doc(t.id)
        .set({ ...t, memberIds: t.members.map((m) => m.id) });
      return { ok: true, data: t };
    }
    if (action === "deleteTrip") {
      const id = z.string().max(100).parse(event.tripId);
      const expected = z.number().int().parse(event.expectedVersion);
      await db.runTransaction(async (tx: Transaction) => {
        const row = first(await tx.collection("trips").doc(id).get()) as
          Trip | undefined;
        if (!row || row.ownerId !== userId)
          throw new Error("只有创建者可以删除旅行");
        if (row.version !== expected)
          throw new Error("旅行已更新，请刷新后再删除");
        await tx.collection("trips").doc(id).remove();
      });
      return { ok: true, data: { deleted: true } };
    }
    if (action === "saveTrip") {
      const incoming = validateTrip(event.trip);
      const expected = z.number().int().parse(event.expectedVersion);
      const saved = await db.runTransaction(async (tx: Transaction) => {
        const row = first(
          await tx.collection("trips").doc(incoming.id).get(),
        ) as Trip | undefined;
        if (!row) throw new Error("旅行不存在");
        const old = cleanTrip(row);
        if (old.version !== expected)
          throw new Error(
            "其他旅伴已更新旅行，请刷新页面；你的当前编辑仍保留在表单中",
          );
        const next = authorizeUpdate(old, incoming, userId);
        for (const e of next.expenses) {
          if (e.receipt && !e.receipt.startsWith(`cloud://`))
            throw new Error("云端凭证须先上传到私有存储");
          if (e.receipt) {
            const receipt = first(
              await tx.collection("receipts").doc(hash(e.receipt)).get(),
            ) as { tripId: string } | undefined;
            if (!receipt || receipt.tripId !== old.id)
              throw new Error("凭证不属于当前旅行");
          }
        }
        await tx
          .collection("trips")
          .doc(next.id)
          .set({ ...next, memberIds: next.members.map((m) => m.id) });
        return visibleTrip(next, userId);
      });
      return { ok: true, data: saved };
    }
    if (action === "generatePlan") {
      const input = planInputSchema.parse(event.input);
      const key = process.env.LLM_API_KEY || "";
      if (!key) throw new Error("服务端尚未配置模型密钥，请联系管理员");
      const quotaId = hash(
        `${userId}:${new Date().toISOString().slice(0, 10)}`,
      );
      await db.runTransaction(async (tx: Transaction) => {
        const row = first(
          await tx.collection("ai_usage").doc(quotaId).get(),
        ) as { count: number } | undefined;
        const limit = Number(process.env.AI_DAILY_LIMIT || "10");
        if (row && row.count >= limit)
          throw new Error("今天的 AI 生成次数已用完，明天再来吧");
        await tx
          .collection("ai_usage")
          .doc(quotaId)
          .set({
            count: (row?.count || 0) + 1,
            userId,
            date: new Date().toISOString().slice(0, 10),
          });
      });
      const inputHash = hash(JSON.stringify(input));
      const cached = (await get("ai_cache", hash(userId + inputHash))) as
        { result: unknown; expiresAt: number } | undefined;
      if (cached && cached.expiresAt > Date.now())
        return { ok: true, data: cached.result };
      const started = Date.now();
      try {
        const result = await generateWithProvider(input, key, {
          baseUrl: process.env.LLM_BASE_URL,
          model: process.env.LLM_MODEL,
        });
        await db
          .collection("ai_cache")
          .doc(hash(userId + inputHash))
          .set({ result, expiresAt: Date.now() + 300000 });
        await db
          .collection("ai_jobs")
          .add({
            userId,
            inputHash,
            promptVersion: "moodnomad-v1",
            model: process.env.LLM_MODEL || "gpt-4o-mini",
            status: "succeeded",
            durationMs: Date.now() - started,
            createdAt: Date.now(),
          });
        return { ok: true, data: result };
      } catch {
        await db
          .collection("ai_jobs")
          .add({
            userId,
            inputHash,
            promptVersion: "moodnomad-v1",
            status: "failed",
            durationMs: Date.now() - started,
            createdAt: Date.now(),
          });
        throw new Error("攻略暂时未能生成，请稍后重试；未写入行程");
      }
    }
    if (action === "createShare") {
      const tripId = z.string().parse(event.tripId);
      const t = cleanTrip(await requireTrip(tripId, userId));
      const type = z.enum(["trip", "ledger"]).parse(event.type);
      const showNames = z.boolean().parse(event.showNames);
      const code = token();
      await db
        .collection("shares")
        .doc(hash(code))
        .set({
          tripId,
          createdBy: userId,
          snapshot: makeSnapshot(t, type, showNames),
          expiresAt: Date.now() + 7 * 86400000,
          revoked: false,
        });
      return { ok: true, data: { token: code } };
    }
    if (action === "revokeShare") {
      const tripId = z.string().parse(event.tripId);
      await requireOwner(tripId, userId);
      const code = z.string().parse(event.token);
      const row = (await get("shares", hash(code))) as
        { tripId: string } | undefined;
      if (!row || row.tripId !== tripId) throw new Error("分享不存在");
      await db.collection("shares").doc(hash(code)).update({ revoked: true });
      return { ok: true, data: { revoked: true } };
    }
    if (action === "createInvite") {
      const tripId = z.string().parse(event.tripId);
      await requireOwner(tripId, userId);
      const code = token();
      await db
        .collection("invitations")
        .doc(hash(code))
        .set({
          tripId,
          createdBy: userId,
          expiresAt: Date.now() + 7 * 86400000,
          revoked: false,
        });
      return { ok: true, data: { token: code } };
    }
    if (action === "joinTrip") {
      const code = z
        .string()
        .regex(/^[A-Za-z0-9_-]{32}$/)
        .parse(event.token);
      const invite = (await get("invitations", hash(code))) as
        { tripId: string; expiresAt: number; revoked: boolean } | undefined;
      if (!invite || invite.revoked || invite.expiresAt < Date.now())
        throw new Error("邀请码无效或已过期");
      const user = (await get("users", userId)) as { name: string } | undefined;
      await db.runTransaction(async (tx: Transaction) => {
        const raw = first(
          await tx.collection("trips").doc(invite.tripId).get(),
        ) as Trip | undefined;
        if (!raw) throw new Error("旅行不存在");
        const t = cleanTrip(raw);
        if (t.members.some((m) => m.id === userId)) return;
        if (t.members.length >= 20) throw new Error("旅伴已满，最多 20 人");
        const next = {
          ...t,
          members: [
            ...t.members,
            {
              id: userId,
              name: user?.name || "新旅人",
              color: "#8ca58f",
              role: "editor" as const,
            },
          ],
          version: t.version + 1,
        };
        await tx
          .collection("trips")
          .doc(t.id)
          .set({ ...next, memberIds: next.members.map((m) => m.id) });
      });
      return { ok: true, data: { joined: true } };
    }
    if (action === "uploadReceipt") {
      const tripId = z.string().parse(event.tripId);
      const t = await requireTrip(tripId, userId);
      if (t.members.find((m) => m.id === userId)?.role === "viewer")
        throw new Error("只读成员不能上传凭证");
      const data = z
        .string()
        .max(1000000)
        .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/)
        .parse(event.data);
      const body = Buffer.from(data.split(",")[1], "base64");
      if (body[0] !== 0xff || body[1] !== 0xd8) throw new Error("图片格式无效");
      const result = await app.uploadFile({
        cloudPath: `receipts/${tripId}/${hash(userId).slice(0, 16)}/${token()}.jpg`,
        fileContent: body,
      });
      await db
        .collection("receipts")
        .doc(hash(result.fileID))
        .set({
          fileId: result.fileID,
          tripId,
          createdBy: userId,
          createdAt: Date.now(),
        });
      return { ok: true, data: result.fileID };
    }
    if (action === "receiptUrl") {
      const t = await requireTrip(z.string().parse(event.tripId), userId);
      const e = t.expenses.find((x) => x.id === event.expenseId);
      if (!e?.receipt) throw new Error("凭证不存在");
      const urls = await app.getTempFileURL({
        fileList: [{ fileID: e.receipt, maxAge: 300 }],
      });
      return { ok: true, data: urls.fileList[0].tempFileURL };
    }
    throw new Error("不支持的操作");
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof z.ZodError
          ? "输入信息不完整或格式不正确"
          : e instanceof Error
            ? e.message
            : "服务暂时不可用",
    };
  }
}
