import { NextResponse } from "next/server";
import { sessionAuthorization } from "@/lib/session";

export async function GET() {
  const authorization=await sessionAuthorization();
  if(!authorization)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(!process.env.API_INTERNAL_URL)
    return NextResponse.json({error:"Internal API not configured"},{status:503});
  try{
    const upstream=await fetch(process.env.API_INTERNAL_URL+"/api/command-center/summary",{
      method:"GET",headers:{authorization,accept:"application/json"},
      cache:"no-store",signal:AbortSignal.timeout(15000)
    });
    return new NextResponse(await upstream.text(),{
      status:upstream.status,headers:{"content-type":"application/json","cache-control":"no-store"}
    });
  }catch{
    return NextResponse.json({error:"Service unavailable"},{status:503});
  }
}
