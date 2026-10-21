import { cloudCall } from './cloud';
import { planInputSchema,planSchema } from '../domain/plan-schema';
export { planInputSchema,planSchema } from '../domain/plan-schema';
import type { GeneratedPlan, PlanInput } from '../domain/types';
export function mockPlan(input:PlanInput):GeneratedPlan {
  planInputSchema.parse(input);
  const curated:Record<string,[string,string,number,number][]>={大理:[['大理古城','大理市大理古城',25.695,100.164],['喜洲古镇','大理市喜洲镇',25.852,100.13],['苍山山麓','大理市苍山景区周边',25.685,100.119],['双廊古镇','大理市双廊镇',25.918,100.192],['龙龛码头','大理市龙龛村',25.677,100.207]],杭州:[['西湖湖滨','杭州市西湖风景区',30.25,120.15],['龙井村','杭州市西湖区龙井村',30.219,120.105],['京杭大运河','杭州市拱墅区拱宸桥',30.32,120.14]],成都:[['人民公园','成都市青羊区人民公园',30.658,104.055],['宽窄巷子','成都市青羊区宽窄巷子',30.669,104.051],['望江楼公园','成都市武侯区望江楼公园',30.628,104.084]]};
  const locations=curated[input.destination];
  const perItem=Math.floor(input.budgetMinor/input.days/5);
  return {title:`${input.destination} · ${input.days} 天慢游计划`,summary:`为 ${input.travelers} 位旅伴安排的${input.pace==='relaxed'?'轻松':input.pace==='packed'?'充实':'均衡'}旅程，留一点时间给沿途的惊喜。`,assumptions:['此为规则生成的演示攻略，并未调用大模型。','费用是全体成员合计的示例估算；营业、票价与交通请出发前确认。',...(!locations?['该目的地仅生成通用活动建议，没有虚构具体景点和坐标。']:[])],days:Array.from({length:input.days},(_,i)=>{
    const spot=locations?.[i%locations.length];
    return {theme:['初见城市 · 慢慢走走','在地生活 · 寻找烟火','走进自然 · 放空自己','人文漫步 · 收藏风景','自由时光 · 带着回忆'][i%5],items:[
      {name:spot?.[0]??`${input.destination} · 城市漫步（待选地点）`,time:'09:30',duration:120,type:'attraction' as const,costMinor:perItem,note:'示例建议：请自行核验地点、开放与预约信息。',address:spot?.[1]??'请补充具体地址',...(spot?{lat:spot[2],lng:spot[3]}:{})},
      {name:'寻味当地 · 午餐时间',time:'12:00',duration:90,type:'food' as const,costMinor:perItem,note:'根据大家的口味现场选择，预算为全体成员合计。',address:'餐厅待选'},
      {name:input.interests.includes('自然风光')?'湖边或公园 · 轻松散步':'街区漫步 · 咖啡与小店',time:'15:00',duration:150,type:'rest' as const,costMinor:Math.floor(perItem/2),note:'不赶路，给临时起意的快乐留点空间。',address:'具体地点待选'},
    ]};})};
}
export async function generatePlan(input:PlanInput):Promise<GeneratedPlan>{
  if(import.meta.env.VITE_DATA_MODE==='cloud'){
    return planSchema.parse(await cloudCall('generatePlan',{input}));
  }
  await new Promise(r=>setTimeout(r,1100));return planSchema.parse(mockPlan(input));
}
