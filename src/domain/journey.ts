import type {
  Activity,
  Category,
  GeneratedPlan,
  PlanInput,
  Trip,
  Member,
} from "./types";
import { uid } from "./types";
import { addDays } from "../services/storage";
export const activityCategory = (type: Activity["type"]): Category =>
  (
    ({
      food: "餐饮",
      rest: "餐饮",
      transport: "交通",
      hotel: "住宿",
      attraction: "门票",
      shopping: "购物",
      nightlife: "其他",
    }) as const
  )[type];
export function estimatesFor(trip: Trip) {
  return trip.days.flatMap((day, index) =>
    day.items
      .filter((a) => a.costMinor > 0)
      .map((a) => ({
        id: a.id,
        title: a.name,
        amountMinor: a.costMinor,
        category: activityCategory(a.type),
        date: addDays(trip.startDate, index),
      })),
  );
}
export function applyPlan(
  trip: Trip,
  plan: GeneratedPlan,
  input: PlanInput,
  dayIndex?: number,
  actorId = trip.ownerId,
): Trip {
  const generated = plan.days.map((d) => ({
    id: uid(),
    theme: d.theme,
    practical: d.practical,
    items: d.items.map((a) => ({ ...a, id: uid(), done: false })),
  }));
  const days =
    dayIndex === undefined
      ? generated
      : trip.days.map((d, i) =>
          i === dayIndex ? { ...generated[0], id: d.id } : d,
        );
  const suggestions = [
    { title: "确认往返交通与住宿预订", category: "预订" as const },
    { title: "检查证件、常用药和充电设备", category: "物品" as const },
    {
      title: `出发前核验${input.destination}天气与景点预约`,
      category: "待办" as const,
    },
    ...(
      plan.handbook?.sections.find((s) => s.key === "checkpoints")?.rows || []
    ).map((row) => ({
      title: `${row[0]}：${row[1]}`.slice(0, 100),
      category: "待办" as const,
    })),
    ...days
      .filter((_, i) => dayIndex === undefined || i === dayIndex)
      .map((d, i) => ({
        title:
          `第 ${(dayIndex ?? 0) + i + 1} 天：确认${d.items.find((a) => a.type === "food" && a.slot === "dinner")?.name || "餐厅"}营业与预约`.slice(
            0,
            100,
          ),
        category: "预订" as const,
      })),
  ];
  const existing = new Set(trip.checklist.map((c) => c.title));
  const due = input.startDate || trip.startDate;
  return {
    ...trip,
    ...(dayIndex === undefined
      ? {
          handbook: plan.handbook,
          travelProfile: input.travelProfile,
          guideSummary: plan.summary,
          guideAssumptions: plan.assumptions,
          destination: input.destination,
          startDate: input.startDate || trip.startDate,
          budgetMinor: input.budgetMinor,
          pace: input.pace,
          interests: input.interests,
          guideReferences: input.references,
          referencePreferences: input.referencePreferences,
        }
      : {}),
    days,
    ...(dayIndex !== undefined && trip.handbook
      ? {
          guideAssumptions: [
            "已调整单日路线：原旅行手册保留供参考，请重新核验景点、交通与预算。",
            ...(trip.guideAssumptions || []),
          ].slice(0, 10),
        }
      : {}),
    checklist: [
      ...trip.checklist,
      ...suggestions
        .filter((c) => !existing.has(c.title))
        .map((c) => ({
          ...c,
          id: uid(),
          assigneeId: trip.ownerId,
          dueDate: c.title.match(/^出发前([731])天/)
            ? addDays(due, -Number(c.title.match(/^出发前([731])天/)![1]))
            : due,
          private: false,
          createdBy: actorId,
          done: false,
        })),
    ].slice(0, 200),
  };
}
export function newPlannedTrip(
  plan: GeneratedPlan,
  input: PlanInput,
  userId: string,
  name: string,
): Trip {
  const colors = ["#9274a3", "#d9a082", "#86a08e", "#86a2bb"];
  const members: Member[] = Array.from({ length: input.travelers }, (_, i) => ({
    id: i ? uid() : userId,
    name: i ? `旅伴 ${i + 1}` : name,
    color: colors[i % 4],
    role: i ? "editor" : "owner",
  }));
  return applyPlan(
    {
      id: uid(),
      ownerId: userId,
      title: plan.title,
      destination: input.destination,
      startDate: input.startDate || new Date().toISOString().slice(0, 10),
      budgetMinor: input.budgetMinor,
      pace: input.pace,
      interests: input.interests,
      members,
      days: [],
      expenses: [],
      checklist: [],
      version: 1,
      cover: "lake",
    },
    plan,
    input,
  );
}
export function haversine(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const dlat = rad(b.latitude - a.latitude),
    dlng = rad(b.longitude - a.longitude);
  return (
    6371 *
    2 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin(dlat / 2) ** 2 +
            Math.cos(rad(a.latitude)) *
              Math.cos(rad(b.latitude)) *
              Math.sin(dlng / 2) ** 2,
        ),
      ),
    )
  );
}
export const isVisited = (t: Trip) =>
  t.visited === true ||
  (t.visited !== false && t.days.some((d) => d.items.some((a) => a.done)));
