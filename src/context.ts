import { createContext, useContext } from 'react';
import type { AppState, Trip } from './domain/types';
export type View='dashboard'|'trips'|'planner'|'ledger'|'checklist'|'map'|'share'|'settings';
export interface MoodContext {
  state:AppState;trip:Trip;view:View;setView:(view:View)=>void;
  selectTrip:(id:string)=>void;updateTrip:(recipe:(trip:Trip)=>Trip)=>Promise<boolean>;
  createTrip:(trip:Trip)=>Promise<void>;openCreate:()=>void;
  notify:(message:string,tone?:'success'|'error')=>void;
  updateProfile:(name:string)=>void;resetDemo:()=>void;
  canEdit:boolean;isOwner:boolean;saving:boolean;cloud:boolean;
}
export const Mood=createContext<MoodContext|null>(null);
export const useMood=()=>{const value=useContext(Mood);if(!value)throw new Error('MoodNomad context missing');return value;};
