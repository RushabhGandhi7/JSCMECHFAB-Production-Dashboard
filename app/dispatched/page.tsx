"use client";

import { useEffect, useState } from "react";
import { PackageCheck, Download, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Toast } from "@/components/Toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import * as XLSX from "xlsx";

type DispatchedRow = {
  id: string;
  projectNo: string;
  equipmentType: string;
  clientName: string;
  client?: { id: string; name: string } | null;
  createdAt: string;
  dispatchedAt: string | null;
  completionDays: number | null;
  status: string;
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export default function DispatchedPage() {
  const [rows, setRows] = useState<DispatchedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/dispatched");
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        setToast({ kind: "error", message: payload.message ?? "Failed to load dispatched projects" });
        setLoading(false);
        return;
      }
      setRows(payload.data);
    } catch {
      setToast({ kind: "error", message: "Failed to load dispatched projects" });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleExport() {
    const data = rows.map((r) => ({
      "Project Number": r.projectNo,
      "Description": r.equipmentType,
      "Client": r.client?.name ?? r.clientName,
      "Created Date": fmtDate(r.createdAt),
      "Dispatched Date": fmtDate(r.dispatchedAt),
      "Completion Days": r.completionDays ?? "—",
      "Status": r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dispatched Projects");
    XLSX.writeFile(wb, "dispatched_projects.xlsx");
  }

  async function handleDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/projects/${confirmDeleteId}`, { method: "DELETE" });
      const payload = await r.json();
      if (!r.ok || !payload.success) {
        setToast({ kind: "error", message: payload.message || "Failed to remove project" });
        setDeleting(false);
        return;
      }
      setToast({ kind: "success", message: "Project removed to trash" });
      setConfirmDeleteId(null);
      setDeleting(false);
      await load();
    } catch (e) {
      setDeleting(false);
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Failed to remove project" });
    }
  }

  const avgDays =
    rows.length === 0
      ? null
      : Math.round(
          rows.filter((r) => r.completionDays !== null).reduce((s, r) => s + (r.completionDays ?? 0), 0) /
            (rows.filter((r) => r.completionDays !== null).length || 1)
        );

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 bg-[#f8fafc] p-4 md:p-6">

      {/* Header */}
      <header className="industrial-card rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="industrial-label">Manufacturing Control</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
              <PackageCheck className="h-7 w-7 text-violet-600" />
              Dispatched Projects
            </h1>
            <p className="mt-1 text-sm text-slate-500">Completed and dispatched production orders — Admin view.</p>
          </div>
          <button
            onClick={handleExport}
            disabled={rows.length === 0}
            className="btn-success"
          >
            <Download className="h-4 w-4" />
            Export to Excel
          </button>
        </div>
      </header>

      {toast ? <Toast kind={toast.kind} message={toast.message} /> : null}

      {/* KPI strip */}
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="industrial-card rounded-xl p-5">
          <p className="industrial-label">Total Dispatched</p>
          <p className="mt-3 text-4xl font-black text-slate-900">{rows.length}</p>
        </article>
        <article className="industrial-card rounded-xl p-5">
          <p className="industrial-label">Avg. Completion Days</p>
          <p className="mt-3 text-4xl font-black text-violet-700">{avgDays ?? "—"}</p>
        </article>
        <article className="industrial-card rounded-xl p-5">
          <p className="industrial-label">Last Dispatched</p>
          <p className="mt-3 font-mono text-xl font-black text-slate-900">
            {rows[0] ? fmtDate(rows[0].dispatchedAt) : "—"}
          </p>
        </article>
      </section>

      {/* Table */}
      {loading ? (
        <div className="industrial-card rounded-xl p-8">
          <LoadingSpinner label="Loading dispatched projects..." />
        </div>
      ) : rows.length === 0 ? (
        <div className="industrial-card rounded-xl">
          <div className="erp-empty">
            <PackageCheck className="erp-empty-icon h-12 w-12" />
            <p className="erp-empty-title">No dispatched projects yet</p>
            <p className="erp-empty-sub">Projects appear here once marked as Dispatched from the project detail page.</p>
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
                <th>Created Date</th>
                <th>Dispatched Date</th>
                <th>Completion Days</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono font-bold text-slate-900">{r.projectNo}</td>
                  <td className="max-w-xs truncate text-slate-700">{r.equipmentType}</td>
                  <td className="text-slate-700">{r.client?.name ?? r.clientName}</td>
                  <td className="font-mono text-slate-500">{fmtDate(r.createdAt)}</td>
                  <td className="font-mono font-semibold text-violet-700">{fmtDate(r.dispatchedAt)}</td>
                  <td>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-mono text-sm font-bold text-slate-800">
                      {r.completionDays !== null ? `${r.completionDays}d` : "—"}
                    </span>
                  </td>
                  <td>
                    <StatusBadge value={r.status} />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-icon-danger"
                      title="Remove to trash"
                      onClick={() => setConfirmDeleteId(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteId ? (
        <div className="erp-modal-overlay">
          <div className="erp-modal">
            <p className="industrial-label">Admin action</p>
            <h3 className="mt-1 text-lg font-black text-slate-900">Remove dispatched project?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to remove this dispatched project? It will move to <strong>Trash</strong> and can be restored.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                className="btn-danger"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Removing..." : "Move to Trash"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
