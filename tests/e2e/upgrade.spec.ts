import { test, expect } from "@playwright/test";
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
    if (requests++) expect(body.input.adjustment).toBe("第二天换成室内项目");
    await r.fulfill({ json: detailedPlan(input) });
  });
  await nav(page, "AI 灵感规划");
  await page.getByRole("button", { name: "生成 AI 攻略", exact: true }).click();
  await expect(
    page.getByText("AI 生成 · 请核验", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("追问调整（如：第二天换成室内项目）")
    .fill("第二天换成室内项目");
  await page.getByRole("button", { name: "用 AI 调整这份攻略" }).click();
  await expect(
    page.getByText("AI 生成 · 请核验", { exact: true }),
  ).toBeVisible();
  expect(requests).toBe(2);
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
