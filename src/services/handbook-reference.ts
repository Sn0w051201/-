import type { GeneratedPlan, PlanInput } from "../domain/types";
import type { Handbook, HandbookKey } from "../domain/handbook-schema";
const verify = "【需出发前核实】";
/** Offline preparation template: never presents these suggestions as verified local facts. */
export function referenceHandbook(
  input: PlanInput,
  plan: GeneratedPlan,
): Handbook {
  const destination = input.destination;
  const profile = input.travelProfile;
  const sights = [
    ...new Map(
      plan.days
        .flatMap((d) => d.items)
        .filter((a) => a.type === "attraction")
        .map((a) => [a.name, a]),
    ).values(),
  ].slice(0, 12);
  const rows: Record<HandbookKey, string[][]> = {
    basics: [
      [
        "旅行",
        `${destination} · ${input.days}天${profile?.nights ?? input.days - 1}晚 · ${input.startDate || "日期待定"}`,
        `${profile?.season || "季节未说明"}；临行查看天气 ${verify}`,
      ],
      [
        "同行与适配",
        `${input.travelers}人；${profile?.companions || "年龄体力未说明，按普通步行路线参考"}`,
        "儿童、老人、无障碍需求请补充后用AI重新规划",
      ],
      [
        "主题",
        input.interests.join("、") || "未指定",
        `饮食：${profile?.diet || "禁忌未说明，请自行确认"}`,
      ],
      [
        "证件与通讯",
        "核对目的地入境证件、签证、电话卡流量和电源；境内随身带有效证件",
        verify,
      ],
      [
        "语言、支付与时差",
        "下载离线地图翻译；跨境核验语言、时差、汇率和支付方式；紧急电话从当地官方渠道确认",
        verify,
      ],
      [
        "关键3条提醒",
        "先预约必留项目；按片区减少折返；每天预留机动时间",
        "离线模板不判断实时营业、榜单、票价、车次与天气",
      ],
    ],
    transport: [
      [
        "大交通",
        `${profile?.departure || "出发地待补充"} → ${destination}；${profile?.arrivalDeparture || "到达返程时间待补充"}`,
        "在官方铁路或航司平台比较直达方案",
        `动态价格 ${verify}`,
        "先核验抵达站与酒店距离，再确定市内接驳",
      ],
      [
        "最省时",
        "酒店→首个必留景点",
        "比较导航打车与轨道交通实际耗时",
        `导航实时估算 ${verify}`,
        "避开跨城折返，接驳留出缓冲",
      ],
      [
        "最省钱",
        "同片区步行+公共交通",
        profile?.transport || "先查轨道线路与步行距离",
        `票价与交通卡 ${verify}`,
        "核验末班车，夜间保留打车预算",
      ],
      [
        "最省力",
        "车站→酒店→重点活动",
        "打车到可停靠入口；老人儿童优先有电梯出入口",
        `平台动态报价 ${verify}`,
        "确认车站接客点、行李与安全带条件",
      ],
    ],
    stays: [
      [
        "中心城区的交通枢纽附近",
        "首次到访、亲子",
        `${profile?.accommodation || "房型早餐未说明"}；价格 ${verify}`,
        `按酒店真实地址导航 ${verify}`,
        `入住退房、行李寄存 ${verify}`,
        "换乘方便；避开临街噪声，核验电梯及夜间照明",
      ],
      [
        "主要游览片区周边",
        "慢节奏、摄影、老人",
        `按整程住宿预算筛选；房型早餐 ${verify}`,
        `到${sights[0]?.name || "必去景点"}的实际入口距离 ${verify}`,
        `与商家确认 ${verify}`,
        "减少每天通勤；独行优先前台服务与安全的返程路线",
      ],
    ],
    food: plan.days[0].items
      .filter((a) => ["food", "rest", "shopping"].includes(a.type))
      .slice(0, 6)
      .map((a) => [
        a.name,
        a.details?.highlights.join("；") || a.note,
        `以全员活动预估除以${input.travelers}人为参考；实际价格 ${verify}`,
        `${a.details?.reservation || "官方渠道核验"} ${verify}`,
        `${profile?.diet || "先确认过敏原"}；排队超过30分钟换附近备选；跨境退税 ${verify}`,
        profile?.companions || "按个人饮食与体力筛选",
      ]),
    sights: sights.map((a, i) => [
      `${a.name} · ${i === 0 ? "优先保留" : "可选"}`,
      a.details?.reason || "按已选路线体验",
      `日间拍照，具体光线与开放时段 ${verify}`,
      `官方导览开放情况 ${verify}`,
      `按现场步行与无障碍条件 ${verify}`,
      i === 0
        ? "优先保留；天气不适则换同片区室内活动"
        : "时间不够时先删远距离和排队项目",
    ]),
    safety: [
      [
        "治安与夜间",
        "贵重物品贴身保管；夜间选择明亮主路",
        "独行告知可信联系人路线，避免偏僻捷径",
      ],
      [
        "天气装备",
        "携带雨具、防晒、适季衣物与防滑鞋",
        `出发前与每天出门前查看天气 ${verify}`,
      ],
      [
        "医疗保险",
        "备好自用常备药及原包装；过敏者带说明",
        `核对保险承保范围、住宿附近医院和当地急救方式 ${verify}`,
      ],
      [
        "礼仪与消费",
        "宗教场所先查着装与拍摄要求；明码标价后消费",
        `节假日预约和拥堵 ${verify}；不向陌生人转账购买非正规门票`,
      ],
      [
        "同行照顾",
        "儿童随身联络卡；老人优先电梯与休息点",
        "体力下降时删夜游与可选项目，保留用餐和返程",
      ],
    ],
    tools: [
      [
        "地图与打车",
        "目的地适用的正规地图、公共交通与打车App",
        "下载离线地图，截图车站出口与酒店入口",
      ],
      [
        "翻译与汇率",
        "跨境下载离线语言包和汇率工具",
        `语言与当日汇率 ${verify}`,
      ],
      [
        "住宿地址",
        "入住确认后复制酒店当地语言原文地址",
        "离线保存地址、订单、寄存条件和前台联系方式",
      ],
      [
        "重要联系人",
        "填写当地官方紧急号码和同行人、家人联系方式",
        `号码 ${verify}；纸质备份，不在公开分享中展示个人证件`,
      ],
      [
        "行程备份",
        "备份证件、车票、保险、酒店订单和行程",
        "手机离线+可信联系人副本，原件与副本分开放",
      ],
    ],
    emergency: [
      [
        "下雨",
        "室外体验受影响",
        "优先换同片区室内馆或室内餐饮休息",
        `核验开放和预约 ${verify}；减少远距离车费`,
      ],
      [
        "排队太久",
        "预计等待超过30分钟",
        "跳过可选活动，先去下一站，错峰再决定是否返回",
        `核验票务退改 ${verify}`,
      ],
      [
        "临时闭馆",
        "官方公告或现场停止开放",
        "采用当天活动列出的备选，保留附近用餐",
        `先查替代点预约 ${verify}`,
      ],
      [
        "交通延误",
        "预计抵达晚于活动预约",
        "先联系住宿与票务，删首日可选活动，保留安全接驳",
        `退改和额外交通费用 ${verify}`,
      ],
      [
        "体力不支",
        "步行或高温造成明显疲劳",
        "结束可选活动，返回住宿或附近室内休息；不适及时求助",
        `打车报价与医疗渠道 ${verify}`,
      ],
      [
        "订不到票",
        "必去项目官方名额已满",
        "查看官方其他时段，或用同片区备选替代，拒绝黄牛",
        `下一开放日与退改 ${verify}`,
      ],
      [
        "预算超支",
        "实际消费接近总预算上限",
        "取消购物与额外门票，保护住宿、正餐及返程预算",
        `每日查账，未来价格 ${verify}`,
      ],
    ],
    checkpoints: [
      [
        "出发前7天",
        "核验交通、住宿、证件和保险",
        "订单、地址、取消政策已离线备份",
      ],
      ["出发前7天", "确认必留项目的官方预约节点", "预约条件与开售提醒已记录"],
      ["出发前3天", "核对天气与闭馆公告，确认替代路线", "雨天和体力备选可执行"],
      ["出发前3天", "确认过敏、用药、儿童老人需求", "餐厅与住宿条件已直接确认"],
      [
        "出发前1天",
        "下载离线地图与订单，充电并整理行李",
        "证件、药物、电源和雨具已装包",
      ],
      [
        "出发前1天",
        "再次确认出发时刻、接驳和集合地点",
        "全员收到行程与紧急联系人",
      ],
    ],
  };
  if (rows.sights.length < 2)
    rows.sights.push([
      "可选活动取舍",
      "优先保留已预约的核心体验",
      "拍摄时段需核验",
      "按官方提供的导览选择",
      "疲劳及时休息",
      "先删购物与夜游，保护返程",
    ]);
  const percentages = [20, 30, 20, 15, 5, 3, 7];
  const categories = [
    "交通",
    "住宿",
    "餐饮",
    "门票",
    "购物",
    "保险",
    "其他",
  ] as const;
  let assigned = 0;
  const budget = categories.map((category, i) => {
    const maxMinor =
      i === 6
        ? input.budgetMinor - assigned
        : Math.floor((input.budgetMinor * percentages[i]) / 100);
    assigned += maxMinor;
    return {
      category,
      minMinor: 0,
      maxMinor,
      note:
        category === "其他"
          ? "弹性预留，优先保障必要支出；确认现金/银行卡/移动支付可用性"
          : "离线分配模板，非真实报价；实际不足请删可选项目，不与活动预估重复相加。",
    };
  });
  return {
    sections: (Object.keys(rows) as HandbookKey[]).map((key) => ({
      key,
      rows: rows[key],
    })),
    budget,
  };
}
export function enrichReference(
  input: PlanInput,
  plan: GeneratedPlan,
): GeneratedPlan {
  if (!input.detailedGuide) return plan;
  const result: GeneratedPlan = {
    ...plan,
    assumptions: [
      "离线准备模板：未调用AI，不会按所有新增偏好定制或核实实时信息。",
      ...plan.assumptions,
    ].slice(0, 10),
    days: plan.days.map((d) => ({
      ...d,
      practical: {
        bufferMinutes: 60,
        bufferPlan:
          "午后与晚餐之间预留60分钟，可删茶歇或缩短可选活动；出发前人工核对衔接。",
        rain: "替换为当天推荐的附近备选，核验室内开放条件。",
        queue: "等待超过30分钟时先去下一站，跳过可选项目。",
        closure: "用活动列出的附近备选替代，先核验是否开放。",
        tired: "删夜间活动，回酒店休息，保留用餐和返程。",
      },
      items: d.items.map((a, i) => ({
        ...a,
        execution: {
          priority: i === 1 ? "必留" : "可选",
          openingHours: verify,
          effort: "中",
          audience: "仅通用参考，按年龄体力和过敏情况核实",
          minMinor: a.costMinor,
          maxMinor: a.costMinor,
        },
      })),
    })),
  };
  result.handbook = referenceHandbook(input, result);
  return result;
}
