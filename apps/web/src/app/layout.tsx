import type { Metadata } from "next";
import "./globals.css";
import "./design-system.css";
import {OperationsCommand} from "@/components/operations-command";
export const metadata: Metadata = { title: "SHL Operations", description: "Internal operations workspace" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<OperationsCommand/></body></html>;
}

