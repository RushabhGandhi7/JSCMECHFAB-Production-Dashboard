"use client";

import { useEffect, useMemo, useState } from "react";
import { PackageCheck, Download, Trash2, Filter, Calendar } from "lucide-react";
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

/** Returns "YYYY-MM" string from an ISO date, or null. */
function toYearMonth(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-04" → "Apr 2026" */
function fmtYearMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${new Date(Number(y), Number(m) - 1).toLocaleString(undefined, { month: "long" })} ${y}`;
}

function buildExcelRows(rows: DispatchedRow[]) {
  return rows.map((r) => ({
    "Project No":       r.projectNo,
    "Description":      r.equipmentType,
    "Client":           r.client?.name ?? r.clientName,
    "Start Date":       fmtDate(r.createdAt),
    "Dispatch Date":    fmtDate(r.dispatchedAt),
    "Total Days Taken": r.completionDays ?? "—",
    "Status":           r.status,
  }));
}

function downloadXlsx(data: ReturnType<typeof buildExcelRows>, filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dispatched Projects");
  XLSX.writeFile(wb, filename);
}

export default function DispatchedPage() {
  const [rows, setRows] = useState<DispatchedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Dispatch month filter ─────────────────────────────────────────────────
  const [filterMonth, setFilterMonth] = useState<string>(""); // "YYYY-MM" or ""

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

  // ── Derived: unique months for dropdown ──────────────────────────────────
  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    rows.forEach((r) => {
      const ym = toYearMonth(r.dispatchedAt);
      if (ym) months.add(ym);
    });
    return Array.from(months).sort().reverse();
  }, [rows]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!filterMonth) return rows;
    return rows.filter((r) => toYearMonth(r.dispatchedAt) === filterMonth);
  }, [rows, filterMonth]);

  // ── Export handlers ───────────────────────────────────────────────────────
  function handleExportMonthly() {
    if (!filterMonth) {
      setToast({ kind: "error", message: "Select a month filter first to export monthly report." });
      return;
    }
    const data = buildExcelRows(filteredRows);
    downloadXlsx(data, `dispatched_${filterMonth}.xlsx`);
  }

  function handleExportYearly() {
    const year = new Date().getFullYear();
    const yearRows = rows.filter((r) => {
      if (!r.dispatchedAt) return false;
      return new Date(r.dispatchedAt).getFullYear() === year;
    });
    downloadXlsx(buildExcelRows(yearRows), `dispatched_${year}.xlsx`);
  }

  function handleExportAll() {
    downloadXlsx(buildExcelRows(rows), `dispatched_till_date.xlsx`);
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

          {/* Export buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportMonthly}
              disabled={rows.length === 0}
              className="btn-success text-sm"
              title="Export selected month"
            >
              <Download className="h-4 w-4" />
              Monthly
            </button>
            <button
              onClick={handleExportYearly}
              disabled={rows.length === 0}
              className="btn-success text-sm"
              title="Export current year"
            >
              <Download className="h-4 w-4" />
              Yearly
            </button>
            <button
              onClick={handleExportAll}
              disabled={rows.length === 0}
              className="btn-success text-sm"
              title="Export all records"
            >
              <Download className="h-4 w-4" />
              Till Date
            </button>
          </div>
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

      {/* Month filter bar */}
      {!loading && rows.length > 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <Filter className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Filter by month:</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterMonth("")}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                !filterMonth ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              All Months
            </button>
            {uniqueMonths.map((ym) => (
              <button
                key={ym}
                onClick={() => setFilterMonth(ym)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                  filterMonth === ym ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Calendar className="h-3 w-3" />
                {fmtYearMonth(ym)}
              </button>
            ))}
          </div>
          {filterMonth && (
            <span className="ml-auto text-xs text-slate-500">
              Showing <strong>{filteredRows.length}</strong> of {rows.length} records
            </span>
          )}
        </section>
      )}

      {/* Table */}
      {loading ? (
        <div className="industrial-card rounded-xl p-8">
          <LoadingSpinner label="Loading dispatched projects..." />
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="industrial-card rounded-xl">
          <div className="erp-empty">
            <PackageCheck className="erp-empty-icon h-12 w-12" />
            <p className="erp-empty-title">{filterMonth ? `No projects dispatched in ${fmtYearMonth(filterMonth)}` : "No dispatched projects yet"}</p>
            <p className="erp-empty-sub">Projects appear here once marked as Dispatched from the project detail page.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Project No</th>
                <th>Description</th>
                <th>Client</th>
                <th>Start Date</th>
                <th>Dispatch Date</th>
                <th>Total Days</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
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
