import {redirect} from "next/navigation";
import {sessionAuthorization} from "@/lib/session";
import {ProductCompare} from "../catalog";
export default async function CompareProductsPage(){if(!await sessionAuthorization())redirect("/login");return <ProductCompare/>;}
