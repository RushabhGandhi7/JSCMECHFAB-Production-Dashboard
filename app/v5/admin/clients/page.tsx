"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Toast } from "@/components/Toast";

type ClientRow = {
  id: string;
  name: string;
  createdAt: string;
  _count: { projects: number; users: number };
};

export default function V5AdminClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showRenameId, setShowRenameId] = useState<string | null>(null);
  const [showDeleteId, setShowDeleteId] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/v5/clients");
    const payload = await response.json();
    if (payload?.success) setClients(payload.data);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const filtered = useMemo(
    () => clients.filter((client) => client.name.toLowerCase().includes(search.toLowerCase())),
    [clients, search]
  );

  async function addClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const response = await fetch("/api/v5/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: String(fd.get("name") || "") })
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setToast({ kind: "error", message: payload.message || "Failed to add client" });
      return;
    }
    setToast({ kind: "success", message: "Client added" });
    setShowAdd(false);
    await load();
  }

  async function renameClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!showRenameId) return;
    const fd = new FormData(e.currentTarget);
    const response = await fetch(`/api/v5/clients/${showRenameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: String(fd.get("name") || "") })
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
    const response = await fetch(`/api/v5/clients/${showDeleteId}`, { method: "DELETE" });
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
    <main className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">V5 Client Management</h1>
        <p className="mt-1 text-sm text-slate-600">Centralized client master with project/user safety checks.</p>
      </header>
      {toast ? <Toast kind={toast.kind} message={toast.message} /> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients"
            className="rounded-md border border-slate-300 p-2 text-sm"
          />
          <button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white" onClick={() => setShowAdd(true)}>
            Add Client
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="pb-2">Client Name</th>
                <th className="pb-2">Total Projects</th>
                <th className="pb-2">Created At</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr key={client.id} className="border-t border-slate-100">
                  <td className="py-2">{client.name}</td>
                  <td className="py-2">{client._count.projects}</td>
                  <td className="py-2">{new Date(client.createdAt).toLocaleString()}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button className="rounded-md border border-slate-300 px-2 py-1 text-xs" onClick={() => setShowRenameId(client.id)}>
                        Rename
                      </button>
                      <button className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700" onClick={() => setShowDeleteId(client.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showAdd ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <form onSubmit={addClient} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold">Add Client</h3>
            <input name="name" required autoFocus className="mt-3 w-full rounded-md border border-slate-300 p-3" placeholder="Client name" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Save</button>
            </div>
          </form>
        </div>
      ) : null}

      {showRenameId ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <form onSubmit={renameClient} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold">Rename Client</h3>
            <input name="name" required autoFocus className="mt-3 w-full rounded-md border border-slate-300 p-3" placeholder="New client name" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => setShowRenameId(null)}>
                Cancel
              </button>
              <button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Save</button>
            </div>
          </form>
        </div>
      ) : null}

      {showDeleteId ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Delete client?</h3>
            <p className="mt-2 text-sm text-slate-600">Are you sure you want to delete this client?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => setShowDeleteId(null)}>
                Cancel
              </button>
              <button className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white" onClick={deleteClient}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
