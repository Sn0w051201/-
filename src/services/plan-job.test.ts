import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { clearPlanDraft, generateDailyPlan, loadPlanDraft } from "./plan-job";
import { mockPlan } from "./planner";
import { AIRequestError } from "./ai-errors";
import { applyPlan } from "../domain/journey";
import { seedState } from "../data/seed";
const input = {
  destination: "大理",
  days: 5,
  travelers: 4,
  budgetMinor: 800003,
  budgetMinMinor: 100003,
  pace: "relaxed" as const,
  interests: ["当地美食"],
  startDate: "2026-11-06",
};
const scope = { userId: "u1", tripId: "t1", target: "all", newTrip: false };
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => values.delete(key),
  };
}
beforeEach(() => {
  vi.stubGlobal("localStorage", storage());
  vi.stubGlobal("sessionStorage", storage());
  clearPlanDraft();
});
afterEach(() => {
  clearPlanDraft();
  vi.unstubAllGlobals();
});
it("五天只发送五个单日请求，预算整数余数守恒，串联日期与原路线", async () => {
  const progress: number[] = [];
  const calls: Parameters<typeof mockPlan>[0][] = [];
  const request = vi.fn(async (data) => {
    calls.push(data);
    return mockPlan(data);
  });
  const result = await generateDailyPlan(input, request, {
    context: scope,
    onProgress: (p) => progress.push(p.completed),
  });
  expect(result.days).toHaveLength(5);
  expect(calls.map((c) => c.days)).toEqual([1, 1, 1, 1, 1]);
  expect(calls.map((c) => c.dayOffset)).toEqual([0, 1, 2, 3, 4]);
  expect(calls.every((c) => c.totalDays === 5)).toBe(true);
  expect(calls.reduce((n, c) => n + c.budgetMinor, 0)).toBe(input.budgetMinor);
  expect(calls.reduce((n, c) => n + (c.budgetMinMinor || 0), 0)).toBe(
    input.budgetMinMinor,
  );
  expect(calls[0].previousPlan).toBeUndefined();
  expect(JSON.parse(calls[2].previousPlan!).days).toHaveLength(2);
  expect(progress).toEqual([0, 1, 2, 3, 4, 5]);
  const trip = seedState().trips[0];
  const saved = applyPlan(trip, result, input);
  expect(saved.days).toHaveLength(5);
  expect(saved.expenses).toEqual(trip.expenses);
});
it("第三天失败保留前两天，继续时不重复请求已完成的日期", async () => {
  let fail = true;
  const calls: number[] = [];
  const request = vi.fn(async (data) => {
    calls.push(data.dayOffset);
    if (data.dayOffset === 2 && fail)
      throw new AIRequestError("模拟模型错误", "model");
    return mockPlan(data);
  });
  await expect(
    generateDailyPlan(input, request, { context: scope }),
  ).rejects.toMatchObject({
    kind: "model",
    message: expect.stringContaining("已保留 2/5 天"),
  });
  expect(loadPlanDraft()?.parts).toHaveLength(2);
  expect(calls).toEqual([0, 1, 2]);
  fail = false;
  const result = await generateDailyPlan(input, request, {
    context: scope,
    resume: true,
  });
  expect(result.days).toHaveLength(5);
  expect(calls).toEqual([0, 1, 2, 2, 3, 4]);
  const cached = await generateDailyPlan(input, request, {
    context: scope,
    resume: true,
  });
  expect(cached).toEqual(result);
  expect(request).toHaveBeenCalledTimes(6);
});
it("错误天数、畸形内容与超出单日预算不进入草稿或最终结果", async () => {
  await expect(
    generateDailyPlan(input, async () => mockPlan({ ...input, days: 2 }), {
      context: scope,
    }),
  ).rejects.toThrow("天数不一致");
  expect(loadPlanDraft()?.parts).toHaveLength(0);
  const request = async (data: any) => {
    const part = mockPlan(data);
    part.days[0].items[0].costMinor = data.budgetMinor + 1;
    return part;
  };
  await expect(
    generateDailyPlan(input, request, { context: scope }),
  ).rejects.toThrow("日均预估超过预算");
  expect(loadPlanDraft()?.parts).toHaveLength(0);
});
it("单日替换保留原日期偏移与追问原稿，不再次分摊已分配预算", async () => {
  const original = mockPlan(input);
  let actual: any;
  await generateDailyPlan(
    {
      ...input,
      days: 1,
      totalDays: 5,
      dayOffset: 3,
      budgetMinor: 160000,
      budgetMinMinor: 0,
      adjustment: "改为室内",
      previousPlan: JSON.stringify(original),
    },
    async (data) => {
      actual = data;
      return mockPlan(data);
    },
    { context: { ...scope, target: "3" } },
  );
  expect(actual.dayOffset).toBe(3);
  expect(actual.budgetMinor).toBe(160000);
  expect(actual.adjustment).toBe("改为室内");
  expect(JSON.parse(actual.previousPlan).days).toHaveLength(5);
});
it("取消后保留当前完成日并停止后续请求，恢复时从下一天开始", async () => {
  const control = new AbortController();
  const calls: number[] = [];
  const request = async (data: any) => {
    calls.push(data.dayOffset);
    return mockPlan(data);
  };
  await expect(
    generateDailyPlan(input, request, {
      context: scope,
      signal: control.signal,
      onProgress: (p) => {
        if (p.completed === 1) control.abort();
      },
    }),
  ).rejects.toThrow("生成已停止");
  expect(calls).toEqual([0]);
  expect(loadPlanDraft()?.parts).toHaveLength(1);
  await generateDailyPlan(input, request, { context: scope, resume: true });
  expect(calls).toEqual([0, 1, 2, 3, 4]);
});
it("任务身份隔离，草稿可从存储读取，未持有或写入API密钥", async () => {
  const request = vi.fn(async (data) => mockPlan(data));
  await generateDailyPlan({ ...input, days: 1 }, request, {
    context: scope,
    identity: "provider=openai;model=gpt-4o-mini",
  });
  const serialized = localStorage.getItem("moodnomad-ai-plan-draft-v1")!;
  expect(serialized).not.toMatch(/API_KEY|Authorization|Bearer|"key"|"token"/);
  expect(JSON.parse(serialized).context.userId).toBe("u1");
  await generateDailyPlan({ ...input, days: 1 }, request, {
    context: { ...scope, userId: "u2" },
    resume: true,
  });
  expect(request).toHaveBeenCalledTimes(2);
});
it("同一任务并发排队，等待中已完成的结果复用，不重复调用模型", async () => {
  const one = { ...input, days: 1 };
  const request = vi.fn(async (data) => {
    await new Promise((r) => setTimeout(r, 10));
    return mockPlan(data);
  });
  const [a, b] = await Promise.all([
    generateDailyPlan(one, request, { context: scope }),
    generateDailyPlan(one, request, { context: scope }),
  ]);
  expect(a).toEqual(b);
  expect(request).toHaveBeenCalledTimes(1);
});
it("清除草稿后，仍在返回的旧请求不会恢复已丢弃的数据", async () => {
  let release!: () => void;
  const paused = new Promise<void>((r) => (release = r));
  let started!: () => void;
  const ready = new Promise<void>((r) => (started = r));
  const request = async (data: any) => {
    started();
    await paused;
    return mockPlan(data);
  };
  const pending = generateDailyPlan(input, request, { context: scope });
  await ready;
  clearPlanDraft();
  release();
  await expect(pending).rejects.toThrow("生成草稿已清除");
  expect(loadPlanDraft()).toBeNull();
});
it("完整手册失败后保留路线与章节，继续只补未完成分组，保存生成检查清单", async () => {
  const { handbookGroups } = await import("../domain/handbook-schema");
  const complete = { ...input, detailedGuide: true };
  const route = mockPlan(complete);
  const request = vi.fn(async (data) => {
    const value = mockPlan(data);
    delete value.handbook;
    return value;
  });
  const groups: number[] = [];
  let fail = true;
  const requestHandbook = vi.fn(async (_data, index: number) => {
    groups.push(index);
    if (index === 2 && fail) throw new AIRequestError("模拟手册故障", "model");
    return {
      sections: route.handbook!.sections.filter((s) =>
        (handbookGroups[index].keys as readonly string[]).includes(s.key),
      ),
      budget: index === 3 ? route.handbook!.budget : [],
    };
  });
  await expect(
    generateDailyPlan(complete, request, { context: scope, requestHandbook }),
  ).rejects.toThrow("已保留 2/4 组");
  expect(loadPlanDraft()?.parts).toHaveLength(5);
  expect(loadPlanDraft()?.handbookParts).toHaveLength(2);
  fail = false;
  const result = await generateDailyPlan(complete, request, {
    context: scope,
    requestHandbook,
    resume: true,
  });
  expect(request).toHaveBeenCalledTimes(5);
  expect(groups).toEqual([0, 1, 2, 2, 3]);
  expect(result.handbook?.sections).toHaveLength(9);
  const before = seedState().trips[0];
  const saved = applyPlan(before, result, complete);
  expect(saved.checklist.some((c) => c.title.includes("出发前7天"))).toBe(true);
  expect(saved.expenses).toEqual(before.expenses);
  expect(saved.handbook).toEqual(result.handbook);
});
it("路线在手册请求之前即可展示，失败后可零调用恢复；回调修改不影响草稿", async () => {
  const { routeFromDraft } = await import("./plan-job");
  let preview: any;
  const request = vi.fn(async (data) => mockPlan(data));
  const requestHandbook = vi.fn(async () => {
    expect(preview?.days).toHaveLength(5);
    throw new Error("模拟手册结构失败");
  });
  await expect(
    generateDailyPlan({ ...input, detailedGuide: true }, request, {
      context: scope,
      requestHandbook,
      onRouteReady: (plan) => {
        preview = plan;
      },
    }),
  ).rejects.toThrow("手册第 1 组");
  const saved = loadPlanDraft()!;
  const restored = routeFromDraft(saved);
  expect(restored.days).toHaveLength(5);
  expect(restored.handbook).toBeUndefined();
  expect(request).toHaveBeenCalledTimes(5);
  preview.days[0].items[0].name = "回调修改";
  expect(routeFromDraft(loadPlanDraft()!).days[0].items[0].name).not.toBe(
    "回调修改",
  );
});
