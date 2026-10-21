import type { PlaceCandidate, LocalAdvice } from "./local-advice";
import type { z } from "zod";
import type {
  TravelProfile,
  Handbook,
  executionSchema,
  dayPracticalSchema,
} from "./handbook-schema";
export type Role = "owner" | "editor" | "viewer";
export interface Member {
  id: string;
  name: string;
  color: string;
  role: Role;
}
export type ActivityType =
  | "attraction"
  | "food"
  | "transport"
  | "rest"
  | "hotel"
  | "shopping"
  | "nightlife";
export type GuideSlot =
  | "breakfast"
  | "morning"
  | "lunch"
  | "afternoon"
  | "tea"
  | "shopping"
  | "dinner"
  | "evening";
export interface RecommendationSource {
  platform: "大众点评" | "大众点评必吃榜" | "米其林指南" | "本地特色";
  query: string;
}
export interface RecommendationDetails {
  localAdvice?: LocalAdvice;
  reason: string;
  highlights: string[];
  transport: string;
  reservation: string;
  alternatives: string[];
  sources: RecommendationSource[];
}
export interface Activity {
  place?: PlaceCandidate;
  execution?: z.infer<typeof executionSchema>;
  id: string;
  name: string;
  time: string;
  duration: number;
  type: ActivityType;
  costMinor: number;
  note: string;
  address: string;
  lat?: number;
  lng?: number;
  done: boolean;
  slot?: GuideSlot;
  details?: RecommendationDetails;
}
export interface Day {
  practical?: z.infer<typeof dayPracticalSchema>;
  id: string;
  theme: string;
  items: Activity[];
}
export type Category = "餐饮" | "交通" | "住宿" | "门票" | "购物" | "其他";
export type SplitType = "equal" | "ratio" | "fixed";
export interface Expense {
  estimateId?: string;
  id: string;
  title: string;
  amountMinor: number;
  payerId: string;
  participantIds: string[];
  splitType: SplitType;
  shares: Record<string, number>;
  category: Category;
  date: string;
  note: string;
  receipt?: string;
  createdBy: string;
  idempotencyKey: string;
}
export interface ChecklistItem {
  id: string;
  title: string;
  category: "物品" | "待办" | "预订";
  assigneeId: string;
  dueDate: string;
  private: boolean;
  createdBy: string;
  done: boolean;
}
export interface TravelPhoto {
  id: string;
  src: string;
  caption: string;
  takenAt: string;
  createdBy: string;
}
export interface Trip {
  placeCandidates?: PlaceCandidate[];
  handbook?: Handbook;
  travelProfile?: TravelProfile;
  guideSummary?: string;
  guideAssumptions?: string[];
  visited?: boolean;
  photos?: TravelPhoto[];
  id: string;
  ownerId: string;
  title: string;
  destination: string;
  startDate: string;
  budgetMinor: number;
  pace: "relaxed" | "balanced" | "packed";
  interests: string[];
  members: Member[];
  days: Day[];
  expenses: Expense[];
  checklist: ChecklistItem[];
  version: number;
  guideReferences?: string;
  referencePreferences?: ("dianping" | "must-eat" | "michelin" | "local")[];
  settledSignature?: string;
  cover: string;
}
export interface FeedEntry {
  id: string;
  tripId: string;
  text: string;
  at: string;
}
export interface Destination {
  id: string;
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  months: number[];
  days: [number, number];
  budgetMinor: [number, number];
  themes: string[];
  tagline: string;
  highlights: string[];
  foods: string[];
  routes: string[];
  tips: string[];
  photo: string;
  photoSource: string;
}
export interface AppState {
  favorites?: string[];
  customDestinations?: Destination[];
  hiddenDestinations?: string[];
  destinationEdits?: Destination[];
  feed?: FeedEntry[];
  preferences?: { theme: "light" | "dark" | "system" };
  schemaVersion: 1;
  trips: Trip[];
  activeTripId: string;
  profile: { name: string };
  userId: string;
}
export interface PlanInput {
  placeCandidates?: PlaceCandidate[];
  detailedGuide?: boolean;
  travelProfile?: TravelProfile;
  totalDays?: number;
  adjustment?: string;
  previousPlan?: string;
  destination: string;
  days: number;
  budgetMinor: number;
  travelers: number;
  pace: "relaxed" | "balanced" | "packed";
  interests: string[];
  referencePreferences?: ("dianping" | "must-eat" | "michelin" | "local")[];
  references?: string;
  dayOffset?: number;
  startDate?: string;
  budgetMinMinor?: number;
}
export interface GeneratedPlan {
  title: string;
  summary: string;
  assumptions: string[];
  handbook?: Handbook;
  days: Array<{
    theme: string;
    practical?: z.infer<typeof dayPracticalSchema>;
    items: Omit<Activity, "id" | "done">[];
  }>;
}
export const categories: Category[] = [
  "餐饮",
  "交通",
  "住宿",
  "门票",
  "购物",
  "其他",
];
export const uid = () => crypto.randomUUID();
