import type { Metadata } from "next";
import "./globals.css";
import "./design-system.css";
export const metadata: Metadata = { title: "SHL Operations", description: "Internal operations workspace" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

