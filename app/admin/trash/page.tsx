"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RefreshCcw, RotateCcw, Trash2 } from "lucide-react";
import { Toast } from "@/components/Toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function AdminTrashPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const r = await fetch("/api/admin/trash");
      const payload = await r.json();
      if (!r.ok || !payload.success) {
        setToast({ kind: "error", message: payload.message || "Failed to load trash" });
        setLoading(false);
        return;
      }
      setProjects(payload.data);
      setLoading(false);
    } catch (e) {
      setLoading(false);
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Failed to load trash" });
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="industrial-card rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="industrial-label">Admin</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-900">
              <Trash2 className="h-5 w-5 text-red-600" /> Trash
            </h1>
            <p className="mt-1 text-sm text-slate-600">Restore accidentally deleted projects. Client users never see these.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-900 hover:bg-slate-50"
            >
              Back to dashboard
            </Link>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
            >
              <RefreshCcw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>
      </header>

      {toast ? <Toast kind={toast.kind} message={toast.message} /> : null}

      {loading ? (
        <div className="industrial-card rounded-xl p-5">
          <LoadingSpinner label="Loading trash..." />
        </div>
      ) : projects.length === 0 ? (
        <div className="industrial-card rounded-xl p-8 text-center text-slate-600">Trash is empty.</div>
      ) : (
        <div className="industrial-card overflow-hidden rounded-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3">Project No</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Deleted at</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{p.projectNo}</td>
                  <td className="px-4 py-3 text-slate-800">{p.client?.name ?? p.clientName}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{fmtDate(p.deletedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={restoringId === p.id}
                      className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                      onClick={async () => {
                        try {
                          setRestoringId(p.id);
                          const r = await fetch(`/api/projects/${p.id}/restore`, { method: "PATCH" });
                          const payload = await r.json();
                          if (!r.ok || !payload.success) {
                            setToast({ kind: "error", message: payload.message || "Restore failed" });
                            setRestoringId(null);
                            return;
                          }
                          setToast({ kind: "success", message: "Project restored successfully" });
                          setRestoringId(null);
                          load();
                        } catch (e) {
                          setRestoringId(null);
                          setToast({ kind: "error", message: e instanceof Error ? e.message : "Restore failed" });
                        }
                      }}
                    >
                      <RotateCcw className="h-4 w-4" /> {restoringId === p.id ? "Restoring..." : "Restore"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

