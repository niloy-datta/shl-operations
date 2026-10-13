import {NextResponse} from "next/server";
import {sameOrigin,sessionAuthorization} from "@/lib/session";
type Context={params:Promise<{path:string[]}>};
const uuid="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const exact=(v:string)=>new RegExp("^"+v+"$");
const allow:Record<string,RegExp[]>={
  GET:[exact("expenses(/"+uuid+")?"),exact("expenses/summary"),
    exact("commissions/access"),exact("commissions(/"+uuid+"(/history)?)?")],
  POST:[exact("expenses"),exact("commissions")],
  PATCH:[exact("expenses/"+uuid+"/status"),exact("commissions/"+uuid+"/status")]
};
async function relay(request:Request,ctx:Context){
  const {path}=await ctx.params;const resource=path.join("/");
  const method=request.method;
  if(!allow[method]?.some(x=>x.test(resource)))
    return NextResponse.json({error:"Not found"},{status:404});
  if(method!=="GET"&&!sameOrigin(request))
    return NextResponse.json({error:"Invalid origin"},{status:403});
  const auth=await sessionAuthorization();
  if(!auth)return NextResponse.json({error:"Unauthorized"},{status:401});
  const url=new URL(request.url),query=new URLSearchParams();
  for(const key of ["page","size","q"]){
    const value=url.searchParams.get(key);
    if(value!==null)query.set(key,value.slice(0,120));
  }
  try{
    const body=method==="GET"?undefined:await request.text();
    if(body&&body.length>8192)
      return NextResponse.json({error:"Request too large"},{status:413});
    const up=await fetch(process.env.API_INTERNAL_URL+"/api/costs/"+resource+
      (query.size?"?"+query:""),{method,
        headers:{authorization:auth,"content-type":"application/json"},
        body,cache:"no-store",signal:AbortSignal.timeout(15000)});
    return new NextResponse(await up.text(),{status:up.status,
      headers:{"content-type":"application/json","cache-control":"no-store"}});
  }catch{return NextResponse.json({error:"Service unavailable"},{status:503});}
}
export const GET=relay;export const POST=relay;export const PATCH=relay;
