export type Role = 'owner' | 'editor' | 'viewer';
export interface Member { id: string; name: string; color: string; role: Role }
export type ActivityType = 'attraction' | 'food' | 'transport' | 'rest' | 'hotel';
export interface Activity { id: string; name: string; time: string; duration: number; type: ActivityType; costMinor: number; note: string; address: string; lat?: number; lng?: number; done: boolean }
export interface Day { id: string; theme: string; items: Activity[] }
export type Category = '餐饮' | '交通' | '住宿' | '门票' | '购物' | '其他';
export type SplitType = 'equal' | 'ratio' | 'fixed';
export interface Expense { id: string; title: string; amountMinor: number; payerId: string; participantIds: string[]; splitType: SplitType; shares: Record<string, number>; category: Category; date: string; note: string; receipt?: string; createdBy: string; idempotencyKey: string }
export interface ChecklistItem { id: string; title: string; category: '物品' | '待办' | '预订'; assigneeId: string; dueDate: string; private: boolean; createdBy: string; done: boolean }
export interface Trip { id: string; ownerId: string; title: string; destination: string; startDate: string; budgetMinor: number; pace: 'relaxed' | 'balanced' | 'packed'; interests: string[]; members: Member[]; days: Day[]; expenses: Expense[]; checklist: ChecklistItem[]; version: number; settledSignature?: string; cover: string }
export interface AppState { schemaVersion: 1; trips: Trip[]; activeTripId: string; profile: { name: string }; userId: string }
export interface PlanInput { destination: string; days: number; budgetMinor: number; travelers: number; pace: 'relaxed' | 'balanced' | 'packed'; interests: string[] }
export interface GeneratedPlan { title: string; summary: string; assumptions: string[]; days: Array<{ theme: string; items: Omit<Activity, 'id' | 'done'>[] }> }
export const categories: Category[] = ['餐饮', '交通', '住宿', '门票', '购物', '其他'];
export const uid = () => crypto.randomUUID();
