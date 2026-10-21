import { enrichLocalAdvice } from "../../src/services/local-advice-reference";
import { test, expect } from "@playwright/test";
import {
  enrichReference,
  referenceHandbook,
} from "../../src/services/handbook-reference";
import { handbookGroups } from "../../src/domain/handbook-schema";
import { detailedPlan } from "../../src/data/guides";
const input = {
  destination: "大理",
  days: 5,
  budgetMinor: 800000,
  travelers: 4,
  pace: "relaxed" as const,
  interests: ["当地美食"],
};
async function nav(page: import("@playwright/test").Page, name: string) {
  const b = page.getByRole("button", { name, exact: true });
  if (!(await b.first().isVisible()))
    await page.getByRole("button", { name: "打开导航" }).click();
  await b.first().click();
}
test("发现筛选、收藏、刷新与从目的地创建规划", async ({ page }) => {
  await page.goto("/#discover");
  await expect(page.locator(".destination-card")).toHaveCount(56);
  await page.getByLabel("搜索目的地", { exact: true }).fill("杭州");
  await expect(page.locator(".destination-card")).toHaveCount(1);
  await page.getByRole("button", { name: "收藏杭州" }).click();
  await page.reload();
  await page.getByRole("button", { name: "我的种草", exact: true }).click();
  await expect(page.locator(".destination-card")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "收藏杭州" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "旅行指南", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "杭州 · 旅行手册" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "从这里开始 AI 规划" }).click();
  await expect(page.getByLabel("想去哪里")).toHaveValue("杭州");
  await expect(
    page.getByRole("checkbox", { name: "保存为一场新的旅行" }),
  ).toBeChecked();
  await page.getByRole("button", { name: "生成离线参考", exact: true }).click();
  await page.getByRole("button", { name: "创建旅行并保存" }).click();
  await expect(
    page.getByRole("heading", { name: "杭州 · 5 天慢游计划", exact: true }),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("moodnomad-web-v1")!),
  );
  expect(stored.trips[0].expenses).toHaveLength(0);
  expect(stored.trips[0].checklist.length).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("真实 AI 接口请求、追问、失败状态；备份不含密钥", async ({ page }) => {
  await page.goto("/#settings");
  await page
    .getByLabel("模型 API Key", { exact: true })
    .fill("test-private-key");
  await page.getByRole("checkbox", { name: "在此浏览器记住模型密钥" }).check();
  await page.getByRole("button", { name: "保存 AI 配置" }).click();
  let requests = 0;
  await page.route("**/api/ai", async (r) => {
    const body = r.request().postDataJSON();
    expect(body.key).toBe("test-private-key");
    if (body.task !== "handbook") expect(body.input.days).toBe(1);
    if (requests >= 9) expect(body.input.adjustment).toBe("第二天换成室内项目");
    requests++;
    if (body.task === "handbook") {
      const all = referenceHandbook(body.input, body.plan);
      await r.fulfill({
        json: {
          sections: all.sections.filter((s) =>
            (handbookGroups[body.group].keys as readonly string[]).includes(
              s.key,
            ),
          ),
          budget: body.group === 3 ? all.budget : [],
        },
      });
    } else {
      const result = enrichLocalAdvice(
        body.input,
        enrichReference(body.input, detailedPlan(body.input)),
      );
      delete result.handbook;
      await r.fulfill({ json: result });
    }
  });
  await nav(page, "AI 灵感规划");
  await page.getByRole("button", { name: "生成 AI 攻略", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "可执行旅行手册", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("追问调整（如：第二天换成室内项目）")
    .fill("第二天换成室内项目");
  await page.getByRole("button", { name: "用 AI 调整这份攻略" }).click();
  await expect(
    page.getByRole("heading", { name: "可执行旅行手册", exact: true }),
  ).toBeVisible();
  expect(requests).toBe(18);
  await page.unroute("**/api/ai");
  await page.route("**/api/ai", (r) =>
    r.fulfill({ status: 400, json: { error: "密钥无效，请检查配置" } }),
  );
  await page.getByRole("button", { name: "生成 AI 攻略", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("密钥无效");
  await nav(page, "偏好与数据");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出旅行备份" }).click();
  const stream = await (await download).createReadStream();
  let text = "";
  for await (const chunk of stream!) text += chunk;
  expect(text).not.toContain("test-private-key");
});
test("预算图表、预估转实际及防重复记账", async ({ page }) => {
  await page.goto("/#ledger");
  await expect(page.locator(".chart-grid .recharts-wrapper")).toHaveCount(3);
  await page.getByRole("button", { name: "调整预算", exact: true }).click();
  await page.getByLabel("总预算（元）", { exact: true }).fill("100");
  await page.getByRole("button", { name: "保存预算", exact: true }).click();
  await expect(
    page.getByText("已超预算，请调整安排或提高预算。", { exact: false }),
  ).toBeVisible();
  await page
    .getByText("查看预估项目 · 点击记账后请填写实际消费金额", { exact: true })
    .click();
  const row = page.locator(".estimate-row").first();
  await row.getByRole("button", { name: "记实际花费", exact: true }).click();
  await page.getByLabel("金额（元）", { exact: true }).fill("12.34");
  await page.getByRole("button", { name: "保存支出", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "已记账", exact: true }),
  ).toBeDisabled();
  await page.reload();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("moodnomad-web-v1")!),
  );
  expect(
    state.trips[0].expenses.some(
      (e: { amountMinor: number; estimateId?: string }) =>
        e.amountMinor === 1234 && e.estimateId,
    ),
  ).toBe(true);
});
test("照片上传、日期编辑、持久化与年度报告 PNG", async ({ page }) => {
  await page.goto("/#map");
  await page.getByRole("button", { name: "回忆相册", exact: true }).click();
  await page
    .getByLabel("上传旅行照片", { exact: true })
    .setInputFiles("public/images/discover/forest.jpg");
  await expect(page.locator(".photo-wall article")).toHaveCount(1);
  await page.getByRole("button", { name: "编辑回忆", exact: true }).click();
  await page.getByLabel("照片小记").fill("洱海边的第一束光");
  await page.getByLabel("拍摄日期").fill("2026-11-07");
  await page.getByRole("button", { name: "保存回忆", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "洱海边的第一束光" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "回忆相册", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "洱海边的第一束光" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "年度报告", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载年度旅行报告" }).click();
  const stream = await (await pending).createReadStream();
  const chunks = [];
  for await (const c of stream!) chunks.push(c);
  expect(Buffer.concat(chunks).subarray(1, 4).toString()).toBe("PNG");
  await page.getByRole("button", { name: "回忆相册", exact: true }).click();
  await page.getByRole("button", { name: "编辑回忆", exact: true }).click();
  await page.getByRole("button", { name: "删除照片", exact: true }).click();
  await expect(page.locator(".photo-wall article")).toHaveCount(0);
});
test("深色模式、全局目的地搜索和手机布局", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "切换深色模式" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("搜索旅行", { exact: true }).fill("敦煌");
  await page.getByRole("button", { name: "敦煌 目的地 · 开始规划" }).click();
  await expect(page.getByLabel("想去哪里")).toHaveValue("敦煌");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("编辑清单与旅行元数据，删除整场旅行需确认", async ({ page }) => {
  await page.goto("/#checklist");
  const row = page.locator(".checklist-row").first();
  await row.getByRole("button", { name: /^编辑/ }).click();
  await page.getByLabel("要准备什么").fill("出发前备好常用药");
  await page.getByRole("button", { name: "记进清单", exact: true }).click();
  await expect(
    page.getByText("出发前备好常用药", { exact: true }),
  ).toBeVisible();
  await nav(page, "我的行程");
  await page.getByRole("button", { name: "编辑旅行信息" }).click();
  await page.getByLabel("旅行名称", { exact: true }).fill("我们的大理冬日");
  await page.getByRole("button", { name: "保存旅行信息" }).click();
  await expect(
    page.getByRole("heading", { name: "我们的大理冬日", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "删除这场旅行" }).click();
  await page.getByRole("button", { name: "保留旅行" }).click();
  await expect(
    page.getByRole("heading", { name: "我们的大理冬日", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "删除这场旅行" }).click();
  await page.getByRole("button", { name: "确认删除整场旅行" }).click();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("moodnomad-web-v1")!),
  );
  expect(stored.trips).toHaveLength(1);
  expect(stored.trips[0].destination).toBe("杭州");
});
test("网络失败显示健康检查入口，不要求重新配置密钥", async ({ page }) => {
  await page.goto("/#settings");
  await page
    .getByLabel("后端代理地址", { exact: false })
    .fill("https://proxy.example/api/ai");
  await page.getByRole("button", { name: "保存 AI 配置" }).click();
  await page.route("https://proxy.example/api/ai", (r) => r.abort("failed"));
  await nav(page, "AI 灵感规划");
  await page.getByRole("button", { name: "生成 AI 攻略", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "不能判断 API Key 是否有效",
  );
  await expect(
    page.getByRole("link", { name: "打开后端健康检查 ↗" }),
  ).toHaveAttribute("href", "https://proxy.example/api/health");
  await expect(
    page.getByRole("button", { name: "查看 AI 配置", exact: true }),
  ).toHaveCount(0);
});
test("OpenAI 额度不足不提示重填Key，模型不存在时提供配置入口", async ({
  page,
}) => {
  await page.route("**/api/ai", (r) =>
    r.fulfill({
      status: 402,
      json: {
        code: "MODEL_QUOTA",
        error: "模型平台余额或可用额度不足。请检查 API 账单。",
      },
    }),
  );
  await page.goto("/#planner");
  await page.getByRole("button", { name: "生成 AI 攻略", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("额度不足");
  await expect(
    page.getByRole("button", { name: "查看 AI 配置", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "打开后端健康检查 ↗" }),
  ).toHaveCount(0);
  await page.unroute("**/api/ai");
  await page.route("**/api/ai", (r) =>
    r.fulfill({
      status: 404,
      json: {
        code: "MODEL_NOT_FOUND",
        error: "模型不存在或当前账号无权使用。",
      },
    }),
  );
  await page.getByRole("button", { name: "生成 AI 攻略", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("模型不存在");
  await expect(
    page.getByRole("button", { name: "查看 AI 配置", exact: true }),
  ).toBeVisible();
});
test("逐日生成显示进度，失败刷新后继续，已完成日期不重复调用", async ({
  page,
}) => {
  let fail = true;
  let release!: () => void;
  const pause = new Promise<void>((resolve) => (release = resolve));
  const offsets: number[] = [];
  await page.route("**/api/ai", async (r) => {
    const body = r.request().postDataJSON();
    if (body.task === "handbook") {
      const all = referenceHandbook(body.input, body.plan);
      await r.fulfill({
        json: {
          sections: all.sections.filter((s) =>
            (handbookGroups[body.group].keys as readonly string[]).includes(
              s.key,
            ),
          ),
          budget: body.group === 3 ? all.budget : [],
        },
      });
      return;
    }
    expect(body.input.days).toBe(1);
    expect(body.input.totalDays).toBe(5);
    offsets.push(body.input.dayOffset);
    if (body.input.dayOffset === 1 && fail) {
      await pause;
      await r.fulfill({
        status: 422,
        json: { code: "MODEL_OUTPUT_LIMIT", error: "模拟第二天模型输出截断" },
      });
      return;
    }
    const result = enrichLocalAdvice(
      body.input,
      enrichReference(body.input, detailedPlan(body.input)),
    );
    delete result.handbook;
    await r.fulfill({ json: result });
  });
  await page.goto("/#planner");
  await page.getByRole("button", { name: "生成 AI 攻略", exact: true }).click();
  await expect(page.getByText(/已完成 1\/5 天/)).toBeVisible();
  release();
  await expect(page.getByRole("alert")).toContainText("已保留 1/5 天");
  expect(offsets).toEqual([0, 1]);
  expect(
    await page.evaluate(() => localStorage.getItem("moodnomad-web-v1")),
  ).toBeNull();
  fail = false;
  await page.reload();
  await page
    .getByRole("button", { name: "继续未完成天数", exact: true })
    .click();
  await expect(page.locator(".preview-day")).toHaveCount(5);
  expect(offsets).toEqual([0, 1, 1, 2, 3, 4]);
  await expect(
    page.getByText("AI 生成 · 请核验", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "保存到当前旅行", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "已保存到行程", exact: true }),
  ).toBeDisabled();
  const data = await page.evaluate(() => ({
    draft: localStorage.getItem("moodnomad-ai-plan-draft-v1"),
    state: JSON.parse(localStorage.getItem("moodnomad-web-v1")!),
  }));
  expect(data.draft).toBeNull();
  expect(data.state.trips[0].days).toHaveLength(5);
  expect(data.state.trips[0].expenses.some((e: any) => e.estimateId)).toBe(
    false,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("精细攻略传入旅行条件，手册失败后刷新续写、下载和保存检查项", async ({
  page,
}) => {
  const groups: number[] = [];
  let dayCalls = 0;
  let fail = true;
  await page.route("**/api/ai", async (r) => {
    const body = r.request().postDataJSON();
    expect(body.input.travelProfile.diet).toBe("花生过敏，不吃辣");
    expect(body.input.travelProfile.departure).toBe("上海");
    if (body.task === "handbook") {
      groups.push(body.group);
      if (fail && body.group === 1) {
        await r.fulfill({
          status: 422,
          json: { code: "MODEL_OUTPUT_LIMIT", error: "模拟手册截断" },
        });
        return;
      }
      const all = referenceHandbook(body.input, body.plan);
      await r.fulfill({
        json: {
          sections: all.sections.filter((s) =>
            (handbookGroups[body.group].keys as readonly string[]).includes(
              s.key,
            ),
          ),
          budget: body.group === 3 ? all.budget : [],
        },
      });
      return;
    }
    dayCalls++;
    const plan = enrichLocalAdvice(
      body.input,
      enrichReference(body.input, detailedPlan(body.input)),
    );
    delete plan.handbook;
    await r.fulfill({ json: plan });
  });
  await page.goto("/#planner");
  await page.getByLabel("几天的旅行").selectOption("2");
  await expect(page.getByLabel("住宿夜数")).toHaveValue("1");
  await page.getByLabel("出发城市").fill("上海");
  await page.getByLabel("饮食禁忌与过敏").fill("花生过敏，不吃辣");
  await page.getByRole("button", { name: "生成 AI 攻略", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("已保留 1/4 组");
  fail = false;
  await page.reload();
  await page
    .getByRole("button", { name: "继续补全旅行手册", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "可执行旅行手册", exact: true }),
  ).toBeVisible();
  expect(dayCalls).toBe(2);
  expect(groups).toEqual([0, 1, 1, 2, 3]);
  await page.getByText("三、每日行程表 · 2天", { exact: true }).click();
  await expect(page.getByText("机动留白 · 60分钟").first()).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载完整攻略", exact: true }).click();
  const stream = await (await download).createReadStream();
  let markdown = "";
  for await (const c of stream!) markdown += c;
  expect(markdown).toContain("十一、应急与备选");
  expect(markdown).toContain("出发前7天");
  await page
    .getByRole("button", { name: "保存到当前旅行", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "已保存到行程", exact: true }),
  ).toBeDisabled();
  await nav(page, "我的行程");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "可执行旅行手册", exact: true }),
  ).toBeVisible();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("moodnomad-web-v1")!),
  );
  expect(state.trips[0].handbook.sections).toHaveLength(9);
  expect(
    state.trips[0].checklist.some(
      (c: { title: string; dueDate: string }) =>
        c.title.startsWith("出发前7天") && c.dueDate === "2026-10-30",
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("手册等待时可浏览路线，失败后保存路线，刷新可零请求恢复再补全", async ({
  page,
}) => {
  let release!: () => void;
  const pause = new Promise<void>((r) => (release = r));
  let handbookCalls = 0;
  let dayCalls = 0;
  let fail = true;
  await page.route("**/api/ai", async (r) => {
    const body = r.request().postDataJSON();
    if (body.task === "handbook") {
      handbookCalls++;
      if (fail) {
        await pause;
        await r.fulfill({
          status: 502,
          json: { code: "MODEL_OUTPUT_FORMAT", error: "模拟列数校验失败" },
        });
        return;
      }
      const all = referenceHandbook(body.input, body.plan);
      await r.fulfill({
        json: {
          sections: all.sections.filter((s) =>
            (handbookGroups[body.group].keys as readonly string[]).includes(
              s.key,
            ),
          ),
          budget: body.group === 3 ? all.budget : [],
        },
      });
      return;
    }
    dayCalls++;
    const plan = enrichLocalAdvice(
      body.input,
      enrichReference(body.input, detailedPlan(body.input)),
    );
    delete plan.handbook;
    await r.fulfill({ json: plan });
  });
  await page.goto("/#planner");
  await page.getByLabel("几天的旅行").selectOption("2");
  await page.getByRole("button", { name: "生成 AI 攻略", exact: true }).click();
  await expect(
    page.getByText("路线已完成，可以先浏览；手册正在补充", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".preview-day")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "保存到当前旅行", exact: true }),
  ).toBeDisabled();
  release();
  await expect(page.getByRole("alert")).toContainText("模拟列数校验失败");
  await page
    .getByRole("button", { name: "保存到当前旅行", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "已保存到行程", exact: true }),
  ).toBeDisabled();
  const stored = await page.evaluate(() => ({
    state: JSON.parse(localStorage.getItem("moodnomad-web-v1")!),
    draft: JSON.parse(localStorage.getItem("moodnomad-ai-plan-draft-v1")!),
  }));
  expect(stored.state.trips[0].days).toHaveLength(2);
  expect(stored.draft.parts).toHaveLength(2);
  await page.reload();
  await page
    .getByRole("button", { name: "先查看已完成路线", exact: true })
    .click();
  await expect(page.locator(".preview-day")).toHaveCount(2);
  expect(dayCalls).toBe(2);
  expect(handbookCalls).toBe(1);
  fail = false;
  await page
    .getByRole("button", { name: "继续补全旅行手册", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "可执行旅行手册", exact: true }),
  ).toBeVisible();
  expect(dayCalls).toBe(2);
  expect(handbookCalls).toBe(5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
