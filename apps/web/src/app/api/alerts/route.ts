import {NextResponse} from "next/server";
import {sessionAuthorization} from "@/lib/session";
export async function GET(){
  const authorization=await sessionAuthorization();
  if(!authorization)return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const response=await fetch(process.env.API_INTERNAL_URL+"/api/alerts",{
      headers:{authorization},cache:"no-store",signal:AbortSignal.timeout(15000)
    });
    return new NextResponse(await response.text(),{status:response.status,
      headers:{"content-type":"application/json","cache-control":"no-store"}});
  }catch{return NextResponse.json({error:"Service unavailable"},{status:503});}
}
