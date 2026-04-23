"use client";

import { Shield, User } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Toast } from "@/components/Toast";

type UserRow = {
  id: string;
  email: string;
  role: "ADMIN" | "CLIENT";
  createdAt: string;
  client?: { id: string; name: string } | null;
  clientName: string;
};

export default function V5AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "CLIENT">("ALL");
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "CLIENT">("CLIENT");

  async function load() {
    const [usersRes, clientsRes] = await Promise.all([fetch("/api/v5/admin/users"), fetch("/api/v5/clients")]);
    const [usersPayload, clientsPayload] = await Promise.all([usersRes.json(), clientsRes.json()]);
    if (usersPayload?.success) setUsers(usersPayload.data);
    if (clientsPayload?.success) setClients(clientsPayload.data);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const visibleUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch = u.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "ALL" || roleFilter === u.role;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  async function onCreateUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const response = await fetch("/api/v5/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(fd.get("email") || ""),
        password: String(fd.get("password") || ""),
        role: selectedRole,
        clientId: selectedRole === "CLIENT" ? String(fd.get("clientId") || "") : undefined
      })
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setToast({ kind: "error", message: payload.message || "Failed to create user" });
      setLoading(false);
      return;
    }
    setToast({ kind: "success", message: "User created successfully" });
    e.currentTarget.reset();
    setSelectedRole("CLIENT");
    setLoading(false);
    await load();
  }

  async function deleteUser() {
    if (!deletingUserId) return;
    const response = await fetch(`/api/v5/admin/users/${deletingUserId}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setToast({ kind: "error", message: payload.message || "Failed to delete user" });
      return;
    }
    setDeletingUserId(null);
    setToast({ kind: "success", message: "User deleted" });
    await load();
  }

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">V5 User Management</h1>
        <p className="mt-1 text-sm text-slate-600">Create ADMIN and CLIENT accounts with secure role rules.</p>
      </header>

      {toast ? <Toast kind={toast.kind} message={toast.message} /> : null}

      <form onSubmit={onCreateUser} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
        <input name="email" type="text" required placeholder="Email" className="rounded-md border border-slate-300 p-3 text-slate-900" />
        <input
          name="password"
          type="password"
          minLength={8}
          required
          placeholder="Password"
          className="rounded-md border border-slate-300 p-3 text-slate-900"
        />
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as "ADMIN" | "CLIENT")}
          className="rounded-md border border-slate-300 bg-white p-3 text-slate-900"
        >
          <option value="ADMIN">ADMIN</option>
          <option value="CLIENT">CLIENT</option>
        </select>
        {selectedRole === "CLIENT" ? (
          <select name="clientId" required className="rounded-md border border-slate-300 bg-white p-3 text-slate-900" defaultValue="">
            <option value="" disabled>
              Select client...
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Client not required for ADMIN</div>
        )}
        <div className="md:col-span-4">
          <button disabled={loading} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {loading ? "Creating..." : "Create user"}
          </button>
        </div>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users"
              className="rounded-md border border-slate-300 p-2 text-sm"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as "ALL" | "ADMIN" | "CLIENT")}
              className="rounded-md border border-slate-300 bg-white p-2 text-sm"
            >
              <option value="ALL">All roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="CLIENT">CLIENT</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="pb-2">Email</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Client Name</th>
                <th className="pb-2">Created At</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="py-2">{u.email}</td>
                  <td className="py-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                        u.role === "ADMIN" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {u.role === "ADMIN" ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2">{u.role === "CLIENT" ? u.client?.name ?? u.clientName : "—"}</td>
                  <td className="py-2">{new Date(u.createdAt).toLocaleString()}</td>
                  <td className="py-2">
                    <button onClick={() => setDeletingUserId(u.id)} className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {deletingUserId ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Delete user account?</h3>
            <p className="mt-2 text-sm text-slate-600">Are you sure you want to delete this account?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => setDeletingUserId(null)}>
                Cancel
              </button>
              <button className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white" onClick={deleteUser}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
