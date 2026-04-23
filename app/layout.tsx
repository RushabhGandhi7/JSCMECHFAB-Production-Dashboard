import "./globals.css";
import type { Metadata } from "next";
import { UserMenu } from "@/components/UserMenu";
import { HealthPing } from "@/components/HealthPing";

export const metadata: Metadata = {
  title: "JSC MECH FAB LLP PRODUCTION SYSTEM"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#f8fafc] text-slate-900">
        <UserMenu />
        <HealthPing />
        {children}
      </body>
    </html>
  );
}
