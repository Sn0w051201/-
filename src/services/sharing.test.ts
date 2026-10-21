import { expect,it } from 'vitest';
import { makeSnapshot,encodeSnapshot,decodeSnapshot } from './sharing';
import { seedState } from '../data/seed';
it('分享中文摘要可无损往返且不包含私有清单、账单、凭证或 ID',()=>{const t=seedState().trips[0];const snapshot=makeSnapshot(t,'trip',false);expect(decodeSnapshot(encodeSnapshot(snapshot))).toEqual(snapshot);const raw=JSON.stringify(snapshot);for(const key of ['receipt','participantIds','createdBy','checklist','ownerId','names'])expect(raw).not.toContain(key);});
it('账单海报摘要默认不公开昵称与消费细项',()=>{const t=seedState().trips[0];const snapshot=makeSnapshot(t,'ledger',false);expect(snapshot.spentMinor).toBe(216000);expect(snapshot.days).toEqual([]);expect(snapshot.names).toBeUndefined();});
it('拒绝损坏或过大的外部分享载荷',()=>{expect(()=>decodeSnapshot('bad')).toThrow();expect(()=>decodeSnapshot('x'.repeat(30001))).toThrow();});
