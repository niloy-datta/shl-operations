import {NextResponse} from "next/server";
import {sameOrigin,sessionAuthorization} from "@/lib/session";

type Context={params:Promise<{path:string[]}>};
const uuid="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const pattern=new RegExp("^suppliers/"+uuid+"/evidence$");
const review=new RegExp("^suppliers/"+uuid+"/evidence/"+uuid+"/review$");

async function relay(request:Request,context:Context)
{
  const {path}=await context.params;
  const target=path.join("/");
  if(!((request.method==="GET"&&pattern.test(target))||
       (request.method==="POST"&&(pattern.test(target)||review.test(target)))))
  {
    return NextResponse.json({error:"Not found"},{status:404});
  }
  if(request.method!=="GET"&&!sameOrigin(request))
  {
    return NextResponse.json({error:"Invalid origin"},{status:403});
  }
  const authorization=await sessionAuthorization();
  if(!authorization)
  {
    return NextResponse.json({error:"Unauthorized"},{status:401});
  }
  const incoming=new URL(request.url);
  const query=new URLSearchParams();
  for(const key of ["page","size"])
  {
    const value=incoming.searchParams.get(key);
    if(value!==null)query.set(key,value.slice(0,10));
  }
  try
  {
    const body=request.method==="GET"?undefined:await request.text();
    if(body&&body.length>4096)
    {
      return NextResponse.json({error:"Request too large"},{status:413});
    }
    const upstream=await fetch(process.env.API_INTERNAL_URL+
      "/api/supplier-compliance/"+target+(query.size?"?"+query:""),{
        method:request.method,headers:{authorization,"content-type":"application/json"},
        body,cache:"no-store",signal:AbortSignal.timeout(15000)
      });
    return new NextResponse(await upstream.text(),{
      status:upstream.status,headers:{"content-type":"application/json","cache-control":"no-store"}
    });
  }
  catch
  {
    return NextResponse.json({error:"Service unavailable"},{status:503});
  }
}

export const GET=relay;
export const POST=relay;
