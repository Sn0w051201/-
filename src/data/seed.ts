import type { AppState, Trip } from '../domain/types';
export const members = [
  { id: 'me', name: '小沐', color: '#8a709e', role: 'owner' as const },
  { id: 'lin', name: '阿林', color: '#e6a07d', role: 'editor' as const },
  { id: 'zhou', name: '小周', color: '#89a492', role: 'editor' as const },
  { id: 'yu', name: '鱼丸', color: '#8cabc4', role: 'editor' as const },
];
export function seedState(): AppState {
  const trip: Trip = {
    id:'dali-autumn',ownerId:'me',title:'去大理，把日子过慢一点',destination:'大理',startDate:'2026-11-06',budgetMinor:800000,pace:'relaxed',interests:['自然风光','当地美食','人文漫步'],members:structuredClone(members),version:1,cover:'lake',
    days:[
      {id:'d1',theme:'初见大理 · 古城慢时光',items:[
        {id:'a1',name:'大理古城',time:'09:30',duration:120,type:'attraction',costMinor:0,note:'沿着石板路随意走走，感受古城的清晨。开放与交通信息请出发前确认。',address:'大理白族自治州大理古城',lat:25.6949,lng:100.1637,done:true},
        {id:'a2',name:'人民路 · 寻味云南',time:'12:00',duration:90,type:'food',costMinor:24000,note:'试试饵丝和云南小锅米线，费用为 4 人预估。',address:'大理古城人民路',lat:25.696,lng:100.167,done:false},
        {id:'a3',name:'龙龛码头看日落',time:'16:30',duration:120,type:'attraction',costMinor:8000,note:'沿洱海生态廊道散步，给自己留一点发呆时间。',address:'大理市龙龛村',lat:25.677,lng:100.207,done:false},
      ]},
      {id:'d2',theme:'洱海来信 · 风吹过的地方',items:[{id:'a4',name:'喜洲古镇',time:'09:00',duration:150,type:'attraction',costMinor:0,note:'看看白族民居与田野，店铺营业情况请自行确认。',address:'大理市喜洲镇',lat:25.852,lng:100.13,done:false},{id:'a5',name:'海舌生态公园周边',time:'14:00',duration:120,type:'rest',costMinor:16000,note:'沿湖慢走；具体开放范围与预约要求出发前核验。',address:'大理市喜洲镇洱海边',lat:25.876,lng:100.165,done:false}]},
      {id:'d3',theme:'走进苍山 · 和山野对话',items:[{id:'a6',name:'苍山山麓漫步',time:'10:00',duration:180,type:'attraction',costMinor:32000,note:'根据天气与体力选择路线，不含实时票价。',address:'大理市苍山景区周边',lat:25.685,lng:100.119,done:false}]},
      {id:'d4',theme:'双廊一日 · 寻找湖边的光',items:[{id:'a7',name:'双廊古镇',time:'10:00',duration:240,type:'attraction',costMinor:28000,note:'湖边散步、喝杯咖啡，慢慢享受今天。',address:'大理市双廊镇',lat:25.918,lng:100.192,done:false}]},
      {id:'d5',theme:'带着好心情 · 慢慢返程',items:[{id:'a8',name:'古城早餐与伴手礼',time:'09:00',duration:90,type:'food',costMinor:20000,note:'离开前，再尝一口云南味道。',address:'大理古城',lat:25.695,lng:100.164,done:false}]},
    ],
    expenses:[
      {id:'e1',idempotencyKey:'seed-e1',title:'古城庭院民宿 · 两晚',amountMinor:128000,payerId:'me',participantIds:['me','lin','zhou','yu'],splitType:'equal',shares:{},category:'住宿',date:'2026-11-06',note:'两间房，大家一起住',createdBy:'me'},
      {id:'e2',idempotencyKey:'seed-e2',title:'机场到古城 · 包车',amountMinor:28000,payerId:'lin',participantIds:['me','lin','zhou','yu'],splitType:'equal',shares:{},category:'交通',date:'2026-11-06',note:'行李比较多，一起打车',createdBy:'me'},
      {id:'e3',idempotencyKey:'seed-e3',title:'第一顿云南菌菇火锅',amountMinor:36000,payerId:'zhou',participantIds:['me','lin','zhou','yu'],splitType:'equal',shares:{},category:'餐饮',date:'2026-11-06',note:'当地餐厅，仅作示例',createdBy:'me'},
      {id:'e4',idempotencyKey:'seed-e4',title:'洱海骑行 · 租车',amountMinor:24000,payerId:'yu',participantIds:['me','lin','zhou','yu'],splitType:'equal',shares:{},category:'其他',date:'2026-11-07',note:'四辆自行车',createdBy:'me'},
    ],
    checklist:[
      {id:'c1',title:'预订古城附近的民宿',category:'预订',assigneeId:'me',dueDate:'2026-11-01',private:false,createdBy:'me',done:true},
      {id:'c2',title:'确认往返机票时间',category:'预订',assigneeId:'lin',dueDate:'2026-11-01',private:false,createdBy:'me',done:true},
      {id:'c3',title:'带上防晒和墨镜',category:'物品',assigneeId:'me',dueDate:'2026-11-05',private:true,createdBy:'me',done:false},
      {id:'c4',title:'准备常用药品',category:'物品',assigneeId:'zhou',dueDate:'2026-11-05',private:false,createdBy:'me',done:false},
      {id:'c5',title:'查好机场到古城的路线',category:'待办',assigneeId:'yu',dueDate:'2026-11-04',private:false,createdBy:'me',done:false},
      {id:'c6',title:'相机充满电，腾出存储卡',category:'物品',assigneeId:'me',dueDate:'2026-11-05',private:true,createdBy:'me',done:false},
    ],
  };
  const second: Trip = {id:'hangzhou-weekend',ownerId:'me',title:'把周末，交给杭州',destination:'杭州',startDate:'2026-11-21',budgetMinor:300000,pace:'balanced',interests:['人文漫步','当地美食'],members:structuredClone(members.slice(0,2)),days:[{id:'hz1',theme:'西湖边的慢日子',items:[]},{id:'hz2',theme:'茶香与山间步道',items:[]}],expenses:[],checklist:[],version:1,cover:'mountain'};
  return {schemaVersion:1,trips:[trip,second],activeTripId:trip.id,profile:{name:'小沐'},userId:'me'};
}
