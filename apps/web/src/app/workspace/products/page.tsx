import {redirect} from "next/navigation";
import {sessionAuthorization} from "@/lib/session";
import {ProductCatalog} from "./catalog";
export default async function ProductsPage(){if(!await sessionAuthorization())redirect("/login");return <ProductCatalog/>;}
