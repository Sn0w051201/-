import type { AppState, Trip } from '../domain/types';
import { seedState } from '../data/seed';
import { validateTrip } from '../domain/trip-schema';
export const STORAGE_KEY = 'moodnomad-web-v1';
export function validateState(value: unknown): value is AppState {
  try {
    const s=value as AppState;
    if (s?.schemaVersion!==1 || !Array.isArray(s.trips) || !s.profile || typeof s.profile.name!=='string' || typeof s.userId!=='string') return false;
    if (s.trips.length>100) return false;
    if(typeof s.activeTripId!=='string'||s.profile.name.length>30||new Set(s.trips.map(t=>t.id)).size!==s.trips.length)return false;
    for(const t of s.trips)validateTrip(t);
    return true;
  }catch{return false;}
}
export function loadState(): { state: AppState; error?: string } {
  try {const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return {state:seedState()};const state=JSON.parse(raw);if(!validateState(state))throw new Error();return {state};}
  catch{return {state:seedState(),error:'本地数据无法读取，已载入示例。原数据未覆盖；请先导出或重置后保存。'};}
}
export function saveState(state: AppState) {localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
export function addDays(date:string,days:number){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function tripDate(trip:Trip){const fmt=(date:string)=>{const [,m,d]=date.split('-');return `${Number(m)}.${Number(d)}`;};return `${fmt(trip.startDate)} — ${fmt(addDays(trip.startDate,trip.days.length-1))}`;}
