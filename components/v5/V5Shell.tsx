"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/v5/dashboard", label: "Dashboard" },
  { href: "/v5/admin/users", label: "Users" },
  { href: "/v5/admin/clients", label: "Clients" }
];

export function V5Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">WFPCS V5</p>
            <p className="text-lg font-bold text-slate-900">Multi-Admin ERP</p>
          </div>
          <nav className="flex items-center gap-2">
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                    active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
