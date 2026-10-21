import { expect, test } from "@playwright/test";
import { mockPlan } from "../../src/services/planner";
import { groundLocalAdvice } from "../../src/domain/ground-local-advice";
import { referenceHandbook } from "../../src/services/handbook-reference";
import { handbookGroups } from "../../src/domain/handbook-schema";
test("详细吃喝玩乐直接出现在攻略中，点评地址可复制并随行程保存", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          sessionStorage.setItem("test-copied-address", text);
        },
      },
    }),
  );
  await page.route("**/api/ai", async (r) => {
    const body = r.request().postDataJSON();
    expect(
      body.input.travelProfile.localRecommendations.queueToleranceMinutes,
    ).toBe(15);
    expect(body.input.placeCandidates[0].name).toBe(
      "测试资料餐厅（非真实推荐）",
    );
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
    const plan = mockPlan(body.input);
    delete plan.handbook;
    plan.days[0].items[0].details!.localAdvice!.candidateId =
      body.input.placeCandidates[0].id;
    groundLocalAdvice(plan, body.input);
    await r.fulfill({ json: plan });
  });
  await page.goto("/#planner");
  await expect(
    page.getByRole("button", { name: "美食与玩乐", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("几天的旅行").selectOption("1");
  await page.getByLabel("最多愿意排队（分钟）").fill("15");
  await page
    .getByText("把收藏的点评店铺放进攻略（选填，最多12家）", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "添加一家参考店铺", exact: true })
    .click();
  await page
    .getByLabel("店铺 / 场所名称 · 候选1", { exact: true })
    .fill("测试资料餐厅（非真实推荐）");
  await page
    .getByLabel("完整地址（省市区+街道门牌 / 楼层） · 候选1", { exact: true })
    .fill("浙江省杭州市西湖区测试路1号2层");
  await page
    .getByLabel("门店来源链接（HTTPS） · 候选1", { exact: true })
    .fill("https://www.dianping.com/");
  await page.getByRole("button", { name: "生成 AI 攻略", exact: true }).click();
  await expect(page.locator(".local-advice")).toHaveCount(7);
  await expect(
    page.getByText("必点 / 必体验：", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "复制地址", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("地址已复制（含店名）", { exact: true }),
  ).toBeVisible();
  const copied = await page.evaluate(() =>
    sessionStorage.getItem("test-copied-address"),
  );
  expect(copied).toContain("测试资料餐厅");
  expect(copied).toContain("浙江省杭州市西湖区测试路1号2层");
  await expect(
    page.getByRole("link", { name: "去点评核实 ↗" }).first(),
  ).toHaveAttribute("href", "https://www.dianping.com/");
  await expect(
    page.getByRole("link", { name: "地图搜索 / 导航 ↗" }).first(),
  ).toHaveAttribute("href", /uri.amap.com/);
  await page
    .getByRole("button", { name: "保存到当前旅行", exact: true })
    .click();
  await page.getByRole("button", { name: "去看我的行程", exact: true }).click();
  await page.reload();
  await expect(page.locator(".local-advice")).toHaveCount(7);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("剪贴板拒绝时给出手动复制降级，不声称地址已复制", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    }),
  );
  await page.goto("/#planner");
  await page.getByRole("button", { name: "生成离线参考", exact: true }).click();
  await page
    .getByRole("button", { name: "复制地点搜索", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("手动复制店名地址").first()).toBeVisible();
  await expect(
    page
      .getByText("复制未成功，请选择下面文字手动复制。", { exact: true })
      .first(),
  ).toBeVisible();
});
