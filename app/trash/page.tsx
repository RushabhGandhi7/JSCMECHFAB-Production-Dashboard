"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Trash2, Archive } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Toast } from "@/components/Toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";

type DeletedRow = {
  id: string;
  projectNo: string;
  equipmentType: string;
  clientName: string;
  status: string;
  deletedAt: string | null;
  client?: { name: string } | null;
};

export default function TrashPage() {
  const [rows, setRows] = useState<DeletedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmPermDeleteId, setConfirmPermDeleteId] = useState<string | null>(null);
  const [permDeleting, setPermDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/trash");
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        setToast({ kind: "error", message: payload.message ?? "Failed to load trash" });
        setLoading(false);
        return;
      }
      setRows(payload.data);
    } catch {
      setToast({ kind: "error", message: "Failed to load trash" });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function restore(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/projects/${id}/restore`, { method: "PATCH" });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        setToast({ kind: "error", message: payload.message ?? "Restore failed" });
        setBusyId(null);
        return;
      }
      setToast({ kind: "success", message: "Project restored successfully" });
      setBusyId(null);
      await load();
    } catch (e) {
      setBusyId(null);
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Restore failed" });
    }
  }

  async function permanentDelete() {
    if (!confirmPermDeleteId) return;
    setPermDeleting(true);
    try {
      const res = await fetch(`/api/projects/${confirmPermDeleteId}/permanent`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        setToast({ kind: "error", message: payload.message ?? "Delete failed" });
        setPermDeleting(false);
        return;
      }
      setToast({ kind: "success", message: "Project permanently deleted" });
      setConfirmPermDeleteId(null);
      setPermDeleting(false);
      await load();
    } catch (e) {
      setPermDeleting(false);
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Delete failed" });
    }
  }

  function fmtDeleted(iso: string | null | undefined) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString();
  }

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 bg-[#f8fafc] p-4 md:p-6">

      {/* Header */}
      <header className="industrial-card rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="industrial-label">Manufacturing Control</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
              <Archive className="h-7 w-7 text-slate-500" />
              Trash
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Soft-deleted projects. Restore to reactivate or permanently remove.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-right">
            <p className="industrial-label">Total</p>
            <p className="mt-0.5 text-xl font-black text-slate-900">{rows.length}</p>
          </div>
        </div>
      </header>

      {toast ? <Toast kind={toast.kind} message={toast.message} /> : null}

      {loading ? (
        <div className="industrial-card rounded-xl p-8">
          <LoadingSpinner label="Loading trash..." />
        </div>
      ) : rows.length === 0 ? (
        <div className="industrial-card rounded-xl">
          <div className="erp-empty">
            <Archive className="erp-empty-icon h-12 w-12" />
            <p className="erp-empty-title">Trash is empty</p>
            <p className="erp-empty-sub">Deleted projects will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Project Number</th>
                <th>Description</th>
                <th>Client</th>
                <th>Status at Deletion</th>
                <th>Deleted On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono font-bold text-slate-900">{r.projectNo}</td>
                  <td className="max-w-xs truncate text-slate-700">{r.equipmentType}</td>
                  <td className="text-slate-700">{r.client?.name ?? r.clientName}</td>
                  <td>
                    <StatusBadge value={r.status ?? "UNKNOWN"} />
                  </td>
                  <td className="font-mono text-slate-500">{fmtDeleted(r.deletedAt)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => restore(r.id)}
                        className="btn-primary text-xs px-3 py-1.5"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => setConfirmPermDeleteId(r.id)}
                        className="btn-danger text-xs px-3 py-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Forever
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Permanent delete confirmation modal */}
      {confirmPermDeleteId ? (
        <div className="erp-modal-overlay">
          <div className="erp-modal">
            <p className="industrial-label text-red-600">Irreversible action</p>
            <h3 className="mt-1 text-lg font-black text-slate-900">Permanently delete project?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will <strong>permanently remove</strong> the project and all its data. This action <strong>cannot be undone</strong>.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmPermDeleteId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={permDeleting}
                className="btn-danger"
                onClick={permanentDelete}
              >
                <Trash2 className="h-4 w-4" />
                {permDeleting ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
