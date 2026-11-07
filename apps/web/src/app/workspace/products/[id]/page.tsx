import {redirect} from "next/navigation";
import {sessionAuthorization} from "@/lib/session";
import {ProductDetailPage} from "../catalog";
export default async function ProductPage({params}:{params:Promise<{id:string}>}){if(!await sessionAuthorization())redirect("/login");const {id}=await params;return <ProductDetailPage id={id}/>;}
