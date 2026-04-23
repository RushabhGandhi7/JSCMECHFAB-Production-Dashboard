"use client";

import { Shield, User, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Toast } from "@/components/Toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";

type UserRow = {
  id: string;
  email: string;
  role: "ADMIN" | "CLIENT";
  createdAt: string;
  client?: { id: string; name: string } | null;
  clientName: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "CLIENT">("ALL");
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "CLIENT">("CLIENT");

  async function load() {
    setLoadingData(true);
    const [usersRes, clientsRes] = await Promise.all([fetch("/api/admin/users"), fetch("/api/clients")]);
    const [usersPayload, clientsPayload] = await Promise.all([usersRes.json(), clientsRes.json()]);
    if (usersPayload?.success) setUsers(usersPayload.data);
    if (clientsPayload?.success) setClients(clientsPayload.data);
    setLoadingData(false);
  }

  useEffect(() => { load().catch(() => {}); }, []);

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
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(fd.get("email") || ""),
        password: String(fd.get("password") || ""),
        role: selectedRole,
        clientId: selectedRole === "CLIENT" ? String(fd.get("clientId") || "") : undefined,
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setToast({ kind: "error", message: payload.message || "Failed to create user" });
      setLoading(false);
      return;
    }
    setToast({ kind: "success", message: "User created successfully" });
    (e.target as HTMLFormElement).reset();
    setSelectedRole("CLIENT");
    setLoading(false);
    await load();
  }

  async function deleteUser() {
    if (!deletingUserId) return;
    const response = await fetch(`/api/admin/users/${deletingUserId}`, { method: "DELETE" });
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
    <main className="mx-auto max-w-[1500px] space-y-6 bg-[#f8fafc] p-4 md:p-6">

      {/* Header */}
      <header className="industrial-card rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="industrial-label">Manufacturing Control</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
              <UserPlus className="h-7 w-7 text-blue-600" />
              User Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">Create and manage ADMIN and CLIENT accounts.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-right">
            <p className="industrial-label">Total Users</p>
            <p className="mt-0.5 text-xl font-black text-slate-900">{users.length}</p>
          </div>
        </div>
      </header>

      {toast ? <Toast kind={toast.kind} message={toast.message} /> : null}

      {/* Create user form */}
      <section className="industrial-card rounded-xl p-5">
        <h2 className="mb-4 text-sm font-bold text-slate-900">Create New User</h2>
        <form onSubmit={onCreateUser} className="grid gap-3 md:grid-cols-5">
          <input
            name="email"
            type="text"
            required
            placeholder="Email / Login"
            className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <input
            name="password"
            type="password"
            minLength={8}
            required
            placeholder="Password (min 8 chars)"
            className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as "ADMIN" | "CLIENT")}
            className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
          >
            <option value="ADMIN">ADMIN</option>
            <option value="CLIENT">CLIENT</option>
          </select>
          {selectedRole === "CLIENT" ? (
            <select
              name="clientId"
              required
              defaultValue=""
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
            >
              <option value="" disabled>Select client…</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-400">
              No client required for ADMIN
            </div>
          )}
          <button disabled={loading} className="btn-primary justify-center">
            {loading ? "Creating..." : "Create User"}
          </button>
        </form>
      </section>

      {/* Filter + Table */}
      <section className="industrial-card rounded-xl p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email…"
            className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "ALL" | "ADMIN" | "CLIENT")}
            className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400"
          >
            <option value="ALL">All roles</option>
            <option value="ADMIN">ADMIN only</option>
            <option value="CLIENT">CLIENT only</option>
          </select>
          <span className="ml-auto text-xs text-slate-500">{visibleUsers.length} result{visibleUsers.length !== 1 ? "s" : ""}</span>
        </div>

        {loadingData ? (
          <LoadingSpinner label="Loading users..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Email / Login</th>
                  <th>Role</th>
                  <th>Client</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="font-mono font-medium text-slate-900">{u.email}</td>
                    <td>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                          u.role === "ADMIN"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {u.role === "ADMIN" ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                        {u.role}
                      </span>
                    </td>
                    <td className="text-slate-600">{u.role === "CLIENT" ? (u.client?.name ?? u.clientName) : "—"}</td>
                    <td className="font-mono text-slate-500 text-xs">{new Date(u.createdAt).toLocaleString()}</td>
                    <td>
                      <button
                        onClick={() => setDeletingUserId(u.id)}
                        className="btn-danger text-xs px-3 py-1.5"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {visibleUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">No users match your filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Delete user modal */}
      {deletingUserId ? (
        <div className="erp-modal-overlay">
          <div className="erp-modal">
            <p className="industrial-label text-red-600">Admin action</p>
            <h3 className="mt-1 text-lg font-black text-slate-900">Delete user account?</h3>
            <p className="mt-2 text-sm text-slate-600">This will permanently remove the user account. They will no longer be able to log in.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setDeletingUserId(null)}>Cancel</button>
              <button className="btn-danger" onClick={deleteUser}>Delete Account</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
