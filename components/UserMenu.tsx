"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, UserCircle2 } from "lucide-react";

type Me = {
  id: string;
  email: string;
  role: "ADMIN" | "CLIENT";
  clientName: string;
};

export function UserMenu() {
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isActive = (href: string) =>
    pathname === href || Boolean(pathname && pathname.startsWith(`${href}/`));

  useEffect(() => {
    if (pathname === "/login") return;
    let mounted = true;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (!mounted) return;
        if (payload?.success) setMe(payload.data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  if (pathname === "/login" || !me) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur shadow-sm">
      {/*
        KEY LAYOUT: The flex container holds nav links + profile button as siblings.
        The profile dropdown wrapper is OUTSIDE the nav (which has overflow-x:auto)
        so the absolute dropdown is never clipped by nav overflow.
      */}
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-4 px-4 md:px-6">

        {/* Brand */}
        <div className="flex shrink-0 flex-col">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Manufacturing Control</p>
          <p className="text-sm font-black tracking-tight text-slate-900">JSC MECH FAB LLP</p>
        </div>

        {/* Right side: nav links + profile button */}
        <div className="flex items-center gap-2 md:gap-3">

          {/* Nav links — overflow-x:auto only on this inner strip, NOT wrapping the profile dropdown */}
          <nav className="flex items-center gap-1 overflow-x-auto md:gap-2">
            <Link
              href="/dashboard"
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                isActive("/dashboard") ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              Dashboard
            </Link>

            {me.role === "ADMIN" ? (
              <Link
                href="/users"
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                  isActive("/users") ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                Users
              </Link>
            ) : null}

            {me.role === "ADMIN" ? (
              <Link
                href="/clients"
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                  isActive("/clients") ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                Clients
              </Link>
            ) : null}

            {me.role === "ADMIN" ? (
              <Link
                href="/dispatched"
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                  isActive("/dispatched") ? "bg-violet-50 text-violet-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                Dispatched
              </Link>
            ) : null}

            {me.role === "ADMIN" ? (
              <Link
                href="/procurement"
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                  isActive("/procurement") ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                Procurement
              </Link>
            ) : null}

            {me.role === "ADMIN" ? (
              <Link
                href="/trash"
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                  isActive("/trash") ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                Trash
              </Link>
            ) : null}
          </nav>

          {/*
            Profile dropdown — SIBLING of nav, not a child.
            This prevents overflow-x:auto on nav from clipping the dropdown.
            dropdownRef wraps both button and panel for outside-click detection.
          */}
          <div ref={dropdownRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <UserCircle2 className="h-4 w-4 text-slate-400" />
              <span className="max-w-[10rem] truncate">{me.email}</span>
              <ChevronDown
                className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              />
            </button>

            {open ? (
              <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {/* User info */}
                <div className="p-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Signed in as</p>
                  <p className="truncate text-sm font-black text-slate-900">{me.email}</p>
                </div>

                {/* Role + client */}
                <div className="my-1 border-t border-slate-100 px-2 py-2">
                  <p className="text-xs text-slate-600">
                    Role:{" "}
                    <span className={`font-bold ${me.role === "ADMIN" ? "text-blue-700" : "text-slate-900"}`}>
                      {me.role}
                    </span>
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-600">
                    Client: <span className="font-bold text-slate-900">{me.clientName}</span>
                  </p>
                </div>

                {/* Logout */}
                <div className="border-t border-slate-100 pt-1">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      const confirmed = window.confirm("Are you sure you want to logout?");
                      if (!confirmed) return;
                      setLoading(true);
                      try {
                        await fetch("/api/auth/logout", { method: "POST" });
                      } catch {
                        // Best-effort — redirect regardless
                      }
                      window.location.href = "/login";
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4" />
                    {loading ? "Logging out..." : "Logout"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

        </div>
      </div>
    </header>
  );
}
