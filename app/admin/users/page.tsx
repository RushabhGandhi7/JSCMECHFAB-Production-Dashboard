"use client";

import { FormEvent, useEffect, useState } from "react";
import { Toast } from "@/components/Toast";

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (payload?.success) setClients(payload.data);
      })
      .catch(() => {});
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setToast(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(fd.get("email") || ""),
        password: String(fd.get("password") || ""),
        clientId: String(fd.get("clientId") || ""),
        role: "CLIENT"
      })
    });
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      setToast({ kind: "error", message: payload.message || "Failed to create user" });
      setLoading(false);
      return;
    }
    setToast({ kind: "success", message: "Client user created successfully" });
    e.currentTarget.reset();
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="industrial-card rounded-xl p-5">
        <h1 className="text-2xl font-bold text-slate-900">Admin User Management</h1>
        <p className="mt-1 text-sm text-slate-600">Create client-specific login accounts for project isolation.</p>
      </header>

      {toast ? <Toast kind={toast.kind} message={toast.message} /> : null}

      <form onSubmit={onSubmit} className="industrial-card space-y-4 rounded-xl p-5">
        <div>
          <label className="industrial-label">Email</label>
          <input name="email" type="email" required className="mt-1 w-full rounded-md border border-slate-300 p-3 text-slate-900" />
        </div>
        <div>
          <label className="industrial-label">Password</label>
          <input name="password" type="password" minLength={8} required className="mt-1 w-full rounded-md border border-slate-300 p-3 text-slate-900" />
        </div>
        <div>
          <label className="industrial-label">Client</label>
          <select
            name="clientId"
            required
            className="mt-1 w-full rounded-md border border-slate-300 bg-white p-3 text-slate-900"
            defaultValue=""
          >
            <option value="" disabled>
              Select client…
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="industrial-label">Role</label>
          <input value="CLIENT" disabled className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-600" />
        </div>

        <button
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-3 font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create Client User"}
        </button>
      </form>
    </main>
  );
}
