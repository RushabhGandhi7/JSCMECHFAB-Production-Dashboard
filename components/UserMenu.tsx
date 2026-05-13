"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu, UserCircle2, X } from "lucide-react";

type Me = {
  id: string;
  email: string;
  role: "ADMIN" | "CLIENT";
  clientName: string;
};

export function UserMenu() {
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  if (pathname === "/login" || !me) return null;

  async function handleLogout() {
    const confirmed = window.confirm("Are you sure you want to logout?");
    if (!confirmed) return;
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Best-effort — redirect regardless
    }
    window.location.href = "/login";
  }

  return (
    <>
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

          {/* Right side: nav links + profile button (desktop only) */}
          <div className="hidden md:flex items-center gap-2 md:gap-3">

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
                      onClick={handleLogout}
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

          {/* ── Mobile: hamburger button (hidden on md+) ── */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="md:hidden flex items-center justify-center h-10 w-10 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

        </div>
      </header>

      {/* ── Mobile Slide Drawer ─────────────────────────────────────────────── */}
      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="drawer-backdrop md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Manufacturing Control</p>
            <p className="text-sm font-black tracking-tight text-slate-900">JSC MECH FAB LLP</p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center justify-center h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User info strip */}
        <div className="border-b border-slate-100 px-5 py-3 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 shrink-0">
              <UserCircle2 className="h-5 w-5 text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{me.email}</p>
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">{me.role} · {me.clientName}</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <p className="px-2 pb-2 text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">Navigation</p>

          <Link
            href="/dashboard"
            className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-bold transition-colors mb-1 ${
              isActive("/dashboard") ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span className="text-base">📊</span> Dashboard
          </Link>

          {me.role === "ADMIN" && (
            <>
              <Link
                href="/procurement"
                className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-bold transition-colors mb-1 ${
                  isActive("/procurement") ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="text-base">📦</span> Procurement
              </Link>


              <Link
                href="/dispatched"
                className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-bold transition-colors mb-1 ${
                  isActive("/dispatched") ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="text-base">🚚</span> Dispatched
              </Link>

              <Link
                href="/users"
                className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-bold transition-colors mb-1 ${
                  isActive("/users") ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="text-base">👥</span> Users
              </Link>

              <Link
                href="/clients"
                className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-bold transition-colors mb-1 ${
                  isActive("/clients") ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="text-base">🏢</span> Clients
              </Link>

              <Link
                href="/trash"
                className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-bold transition-colors mb-1 ${
                  isActive("/trash") ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="text-base">🗑️</span> Trash
              </Link>
            </>
          )}
        </nav>

        {/* Logout at bottom */}
        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            disabled={loading}
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl bg-red-50 px-4 py-3.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="h-4 w-4" />
            {loading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </>
  );
}
