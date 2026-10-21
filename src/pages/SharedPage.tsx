import { heroImage } from '../data/assets';
import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, LoaderCircle, LockKeyhole, MapPin, Mountain } from 'lucide-react';
import { Button } from '../components/UI';
import type { ShareSnapshot } from '../services/sharing';
import { decodeSnapshot, shareSchema } from '../services/sharing';
import { cloudCall } from '../services/cloud';
import { money } from '../domain/money';
export default function SharedPage({token}:{token:string}){
 const [data,setData]=useState<ShareSnapshot|null>(null);const [error,setError]=useState('');
 useEffect(()=>{let alive=true;const run=async()=>{try{const value=token.startsWith('local.')?decodeSnapshot(token.slice(6)):shareSchema.parse(await cloudCall('getShare',{token}));if(alive)setData(value);}catch(e){if(alive)setError((e as Error).message||'分享已过期或已撤销');}};void run();return()=>{alive=false;};},[token]);
 return <div className="shared-shell"><a className="brand" href={location.pathname}><span className="brand-icon"><Mountain size={25}/></span><strong>MoodNomad.</strong></a>{error?<section className="panel empty"><LockKeyhole size={32}/><h1>这段分享，暂时无法打开</h1><p>{error}</p><a className="btn btn-primary" href={location.pathname}>回到旅行空间</a></section>:!data?<div className="startup"><LoaderCircle className="spin"/>正在打开一段旅途…</div>:<article className="shared-article panel"><img className="shared-cover" src={heroImage} alt="旅途灵感风景"/><div className="shared-content"><span className="eyebrow">A POSTCARD FROM OUR JOURNEY</span><h1>{data.title}</h1><p className="context-line"><MapPin size={16}/>{data.destination}<CalendarDays size={16}/>{data.startDate} — {data.endDate}</p>{data.names&&<p>一起出发：{data.names.join('、')}</p>}{data.type==='trip'?data.days.map((d,i)=><section className="shared-day" key={i}><span>DAY {String(i+1).padStart(2,'0')}</span><h2>{d.theme}</h2>{d.items.map((a,j)=><p key={j}><time>{a.time}</time>{a.name}</p>)}</section>):<section className="shared-budget"><p>旅行支出摘要</p><strong>¥{money(data.spentMinor||0,2)}</strong><p>总预算 ¥{money(data.budgetMinor||0)}</p><small>不包含具体消费、凭证或转账信息。</small></section>}<div className="share-privacy"><LockKeyhole size={18}/><p>{token.startsWith('local.')?'这是由分享者生成的静态摘要快照，任何持有链接的人均可查看。':'只读旅行摘要，不包含私有清单与账单细项。'}费用、地点与时间请自行核验。</p></div><a className="btn btn-primary" href={location.pathname}>开启我的下一段旅途<ArrowRight size={16}/></a></div></article>}</div>;
}
