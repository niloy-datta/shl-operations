import {redirect} from "next/navigation";
import {sessionAuthorization} from "@/lib/session";
import {ProductForm} from "../catalog";
export default async function NewProductPage(){if(!await sessionAuthorization())redirect("/login");return <ProductForm/>;}
