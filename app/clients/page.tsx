"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, PlusCircle } from "lucide-react";
import { Toast } from "@/components/Toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";

type ClientRow = {
  id: string;
  name: string;
  createdAt: string;
  _count: { projects: number; users: number };
};

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showRenameId, setShowRenameId] = useState<string | null>(null);
  const [showDeleteId, setShowDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/clients");
    const payload = await response.json();
    if (payload?.success) setClients(payload.data);
    setLoading(false);
  }

  useEffect(() => { load().catch(() => {}); }, []);

  const filtered = useMemo(
    () => clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [clients, search]
  );

  async function addClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const response = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: String(fd.get("name") || "") }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setToast({ kind: "error", message: payload.message || "Failed to add client" });
      return;
    }
    setToast({ kind: "success", message: "Client added successfully" });
    setShowAdd(false);
    await load();
  }

  async function renameClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!showRenameId) return;
    const fd = new FormData(e.currentTarget);
    const response = await fetch(`/api/clients/${showRenameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: String(fd.get("name") || "") }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setToast({ kind: "error", message: payload.message || "Failed to rename client" });
      return;
    }
    setToast({ kind: "success", message: "Client renamed" });
    setShowRenameId(null);
    await load();
  }

  async function deleteClient() {
    if (!showDeleteId) return;
    const response = await fetch(`/api/clients/${showDeleteId}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setToast({ kind: "error", message: payload.message || "Failed to delete client" });
      return;
    }
    setShowDeleteId(null);
    setToast({ kind: "success", message: "Client deleted" });
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
              <Building2 className="h-7 w-7 text-blue-600" />
              Client Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">Client master — with project and user dependency protection.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-right">
              <p className="industrial-label">Total Clients</p>
              <p className="mt-0.5 text-xl font-black text-slate-900">{clients.length}</p>
            </div>
            <button className="btn-primary" onClick={() => setShowAdd(true)}>
              <PlusCircle className="h-4 w-4" /> Add Client
            </button>
          </div>
        </div>
      </header>

      {toast ? <Toast kind={toast.kind} message={toast.message} /> : null}

      {/* Table */}
      <section className="industrial-card rounded-xl p-5">
        <div className="mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {loading ? (
          <LoadingSpinner label="Loading clients..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Projects</th>
                  <th>Users</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr key={client.id}>
                    <td className="font-semibold text-slate-900">{client.name}</td>
                    <td>
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-100">
                        {client._count.projects} project{client._count.projects !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                        {client._count.users} user{client._count.users !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-slate-500">{new Date(client.createdAt).toLocaleString()}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn-secondary text-xs px-3 py-1.5"
                          onClick={() => setShowRenameId(client.id)}
                        >
                          Rename
                        </button>
                        <button
                          className="btn-danger text-xs px-3 py-1.5"
                          onClick={() => setShowDeleteId(client.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">No clients match your search.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add client modal */}
      {showAdd ? (
        <div className="erp-modal-overlay">
          <form onSubmit={addClient} className="erp-modal">
            <p className="industrial-label">New client</p>
            <h3 className="mt-1 text-lg font-black text-slate-900">Add Client</h3>
            <input
              name="name"
              required
              autoFocus
              className="mt-4 w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              placeholder="Client name"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary">Save Client</button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Rename client modal */}
      {showRenameId ? (
        <div className="erp-modal-overlay">
          <form onSubmit={renameClient} className="erp-modal">
            <p className="industrial-label">Rename client</p>
            <h3 className="mt-1 text-lg font-black text-slate-900">Update Client Name</h3>
            <input
              name="name"
              required
              autoFocus
              className="mt-4 w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              placeholder="New client name"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowRenameId(null)}>Cancel</button>
              <button className="btn-primary">Save</button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Delete client modal */}
      {showDeleteId ? (
        <div className="erp-modal-overlay">
          <div className="erp-modal">
            <p className="industrial-label text-red-600">Admin action</p>
            <h3 className="mt-1 text-lg font-black text-slate-900">Delete client?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Cannot delete clients that have linked projects or users. Unlink them first.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowDeleteId(null)}>Cancel</button>
              <button className="btn-danger" onClick={deleteClient}>Delete</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
