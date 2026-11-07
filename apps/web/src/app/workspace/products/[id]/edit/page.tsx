import {redirect} from "next/navigation";
import {sessionAuthorization} from "@/lib/session";
import {ProductForm} from "../../catalog";
export default async function EditProductPage({params}:{params:Promise<{id:string}>}){if(!await sessionAuthorization())redirect("/login");const {id}=await params;return <ProductForm id={id}/>;}
