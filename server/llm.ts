import { planInputSchema,planSchema } from '../src/domain/plan-schema';
import type { GeneratedPlan } from '../src/domain/types';
export async function generateWithProvider(input:unknown,key:string,options:{baseUrl?:string;model?:string;fetcher?:typeof fetch}={}):Promise<GeneratedPlan>{
 const parsed=planInputSchema.parse(input);if(!key)throw new Error('服务端尚未配置模型密钥，请联系管理员');
 const base=options.baseUrl||'https://api.openai.com/v1';const url=new URL(base);if(url.protocol!=='https:'||url.username||url.password)throw new Error('模型服务地址必须使用 HTTPS');
 const fetcher=options.fetcher||fetch;
 for(let attempt=0;attempt<2;attempt++){
  try{
   const response=await fetcher(base.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),body:JSON.stringify({model:options.model||'gpt-4o-mini',temperature:0.6,max_tokens:6000,response_format:{type:'json_object'},messages:[{role:'system',content:'你是谨慎的旅行规划助手。仅输出有效 JSON。所有金额字段使用人民币整数分，表示全体旅伴合计。不能声称拥有实时票价、天气、营业信息；在 assumptions 提醒出发前核验。不要编造坐标，未知时省略 lat/lng。严格结构：{title:string,summary:string,assumptions:string[],days:[{theme:string,items:[{name:string,time:"HH:mm",duration:整数分钟,type:"attraction"|"food"|"transport"|"rest"|"hotel",costMinor:非负整数,note:string,address:string,lat?:number,lng?:number}]}]}。每天最多 8 项，每项 note 最多 500 字。天数必须等于输入 days。不输出 id 或 done 字段。'},{role:'user',content:JSON.stringify(parsed)}]})});
   if(!response.ok)throw new Error('模型请求未成功');const data=await response.json() as {choices?:{message?:{content?:string}}[]};const text=data.choices?.[0]?.message?.content;if(!text||text.length>100000)throw new Error('模型输出为空或过大');const plan=planSchema.parse(JSON.parse(text));if(plan.days.length!==parsed.days)throw new Error('模型返回天数不一致');return plan;
  }catch{if(attempt===1)throw new Error('攻略暂时未能生成，请稍后重试。未保存无效行程。');}
 }
 throw new Error('生成失败');
}
