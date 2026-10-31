import { NextResponse } from "next/server";
import { sameOrigin, sessionAuthorization } from "@/lib/session";
type Context={params:Promise<{path:string[]}>};
const uuid="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const pattern=(v:string)=>new RegExp("^"+v+"$");
const allowed:Record<string,RegExp[]>={
  GET:[pattern("leads(/"+uuid+"(/activity)?)?"),pattern("leads/"+uuid+"/qualification"),pattern("leads/queue"),pattern("leads/workload"),pattern("leads/"+uuid+"/assignments"),pattern("projects(/"+uuid+"(/notes)?)?")],
  POST:[pattern("leads"),pattern("leads/"+uuid+"/activity"),pattern("leads/"+uuid+"/assign"),pattern("leads/queue/assign-next"),pattern("projects"),pattern("projects/"+uuid+"/notes")],
  PATCH:[pattern("leads/"+uuid+"/status"),pattern("projects/"+uuid+"/status")]
};
async function relay(request:Request,context:Context){
  const {path}=await context.params;
  const target=path.join("/");
  const method=request.method;
  if(!allowed[method]?.some(r=>r.test(target)))
    return NextResponse.json({error:"Not found"},{status:404});
  if(method!=="GET"&&!sameOrigin(request))
    return NextResponse.json({error:"Invalid origin"},{status:403});
  const authorization=await sessionAuthorization();
  if(!authorization)return NextResponse.json({error:"Unauthorized"},{status:401});
  const incoming=new URL(request.url),query=new URLSearchParams();
  for(const name of ["page","size","q"]){
    const v=incoming.searchParams.get(name);
    if(v!==null)query.set(name,v.slice(0,120));
  }
  try {
    const body=method==="GET"?undefined:await request.text();
    if(body&&body.length>8192)
      return NextResponse.json({error:"Request too large"},{status:413});
    const upstream=await fetch(process.env.API_INTERNAL_URL+"/api/growth/"+target+
      (query.size?"?"+query:""),{
        method,headers:{authorization,"content-type":"application/json"},
        body,cache:"no-store",signal:AbortSignal.timeout(15000)
      });
    return new NextResponse(await upstream.text(),{
      status:upstream.status,headers:{"content-type":"application/json","cache-control":"no-store"}
    });
  } catch{return NextResponse.json({error:"Service unavailable"},{status:503});}
}
export const GET=relay;export const POST=relay;export const PATCH=relay;
