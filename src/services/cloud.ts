import type cloudbase from '@cloudbase/js-sdk';
type CloudClient=ReturnType<typeof cloudbase.init>;
let clientPromise:Promise<CloudClient>|undefined;
export async function cloudCall(action:string,payload:Record<string,unknown>={}) {
 const env=import.meta.env.VITE_CLOUDBASE_ENV_ID;
 if(!env)throw new Error('请配置 CloudBase 环境 ID，或切回本地演示模式');
 clientPromise??=import('@cloudbase/js-sdk').then(({default:cloudbase})=>cloudbase.init({env}));
 const client=await clientPromise;const auth=client.auth({persistence:'local'});
 if(!await auth.getLoginState())await auth.anonymousAuthProvider().signIn();
 const response=await client.callFunction({name:'api',data:{action,...payload}});
 const result=response.result as {ok:boolean;data?:unknown;error?:string};
 if(!result.ok)throw new Error(result.error||'云服务暂时不可用，请稍后重试');
 return result.data;
}
