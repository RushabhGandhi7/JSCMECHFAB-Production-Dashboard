"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, BarChart3, CalendarRange, CheckCircle2, Factory, Gauge, PlusCircle, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Toast } from "@/components/Toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const [me, setMe] = useState<{
    role: "ADMIN" | "CLIENT";
    clientName: string;
    clientId?: string | null;
    client?: { name: string } | null;
    email: string;
  } | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [projectNoInput, setProjectNoInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const clientComboRef = useRef<HTMLDivElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch("/api/projects");
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        setToast({ message: payload.message ?? "Failed to fetch projects", kind: "error" });
        setLoading(false);
        return;
      }
      setProjects(payload.data);
      setLoading(false);
    } catch (e) {
      setLoading(false);
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Failed to fetch projects" });
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => { if (payload?.success) setMe(payload.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (me?.role !== "ADMIN") return;
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => { if (payload?.success) setClients(payload.data); })
      .catch(() => {});
  }, [me?.role]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (clientComboRef.current && !clientComboRef.current.contains(e.target as Node)) setClientOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const t = setInterval(() => { load(); }, 60000);
    return () => clearInterval(t);
  }, []);

  const selectedClientName = clients.find((c) => c.id === clientId)?.name ?? "";
  const filteredClients = clients.filter((c) => c.name.toLowerCase().includes(clientQuery.trim().toLowerCase()));

  const kpis = [
    { label: "Total Projects", value: projects.length, icon: Factory, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
    { label: "In Production", value: projects.filter((p) => p.status === "IN_PRODUCTION").length, icon: Gauge, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
    { label: "Completed", value: projects.filter((p) => p.status === "COMPLETED").length, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", border: "border-green-100" },
    { label: "Delayed", value: projects.filter((p) => p.status === "DELAYED").length, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
  ];

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 bg-[#f8fafc] p-4 md:p-6">

      {/* Page header */}
      <header className="industrial-card rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="industrial-label">Manufacturing Control</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Production Dashboard</h1>
            {me?.role === "CLIENT" ? (
              <p className="mt-1 text-sm text-slate-500">View-only — contact admin for updates</p>
            ) : null}
          </div>
          {me ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-right">
              <p className="industrial-label">Tenant</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">{me.clientName}</p>
            </div>
          ) : null}
        </div>
      </header>

      {toast ? <Toast message={toast.message} kind={toast.kind} /> : null}

      {/* KPI cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className={`industrial-card rounded-xl border p-5 ${kpi.border} transition-all duration-200 hover:scale-[1.02] hover:shadow-md`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="industrial-label">{kpi.label}</p>
                <p className="mt-3 text-4xl font-black text-slate-900">{kpi.value}</p>
              </div>
              <div className={`rounded-lg p-2 ${kpi.bg}`}>
                <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
              </div>
            </div>
          </article>
        ))}
      </section>

      {/* Create project form — ADMIN only */}
      {me?.role === "ADMIN" ? (
        <section className="industrial-card rounded-xl p-5">
          <div className="mb-4 flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Create New Project</h2>
          </div>
          <form
            className="grid gap-3 md:grid-cols-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                const response = await fetch("/api/projects", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ projectNo: projectNoInput.trim(), clientId, equipmentType: descriptionInput }),
                });
                const payload = await response.json();
                if (!response.ok || !payload.success) {
                  setToast({ message: payload.message ?? "Project creation failed", kind: "error" });
                  setSaving(false);
                  return;
                }
                setProjectNoInput("");
                setDescriptionInput("");
                setClientId("");
                setClientQuery("");
                setToast({ message: "Project created successfully", kind: "success" });
                load();
                setSaving(false);
              } catch (e) {
                setSaving(false);
                setToast({ kind: "error", message: e instanceof Error ? e.message : "Project creation failed" });
              }
            }}
          >
            <input
              required
              name="projectNo"
              value={projectNoInput}
              onChange={(e) => setProjectNoInput(e.target.value)}
              placeholder="Project Number *"
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none ring-0 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <input
              name="equipmentType"
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              placeholder="Description (optional)"
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none ring-0 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <div ref={clientComboRef} className="relative">
              <input
                role="combobox"
                aria-expanded={clientOpen}
                autoComplete="off"
                value={clientOpen ? clientQuery : selectedClientName || clientQuery}
                onChange={(e) => { setClientQuery(e.target.value); setClientId(""); setClientOpen(true); }}
                onFocus={() => { setClientOpen(true); setClientQuery(clientOpen ? clientQuery : selectedClientName); }}
                placeholder="Select client…"
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              {clientOpen && filteredClients.length > 0 ? (
                <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {filteredClients.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-slate-50"
                        onClick={() => { setClientId(c.id); setClientQuery(c.name); setClientOpen(false); }}
                      >
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {clientOpen && clients.length > 0 && filteredClients.length === 0 ? (
                <p className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg">No match</p>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={saving || !projectNoInput.trim() || !clientId}
              className="btn-primary justify-center py-3"
            >
              {saving ? "Creating..." : "Create Project"}
            </button>
          </form>
        </section>
      ) : null}

      {/* Project list */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900">Active Production</h2>
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{projects.length}</span>
        </div>

        {loading ? (
          <div className="industrial-card rounded-xl p-8">
            <LoadingSpinner label="Loading production projects..." />
          </div>
        ) : projects.length === 0 ? (
          <div className="industrial-card rounded-xl">
            <div className="erp-empty">
              <Factory className="erp-empty-icon h-12 w-12" />
              <p className="erp-empty-title">No active projects</p>
              <p className="erp-empty-sub">Create a project to get started.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {projects.map((project) => {
              const dr = project.metrics.daysRemaining;
              const overdue = dr !== null && dr < 0;
              const statusBorder =
                project.status === "COMPLETED" ? "border-l-green-500"
                  : project.status === "IN_PRODUCTION" ? "border-l-blue-500"
                    : project.status === "DELAYED" ? "border-l-red-500"
                      : "border-l-slate-200";

              return (
                /* ── FIX: entire card is clickable ─────────────────────────── */
                <Link
                  key={project.id}
                  href={`/project/${project.id}`}
                  className="block"
                >
                  <article
                    className={`industrial-card cursor-pointer rounded-xl border-l-4 p-5 transition-all duration-200 hover:shadow-lg hover:scale-[1.005] ${statusBorder}`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="industrial-label">Project No</p>
                        <p className="font-mono text-2xl font-black tracking-tight text-slate-900 transition hover:text-blue-600">
                          {project.projectNo}
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-700">{project.equipmentType}</p>
                        <p className="mt-0.5 text-sm text-slate-500">{project.client?.name ?? project.clientName}</p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 md:ml-auto">
                        <StatusBadge value={project.status} />
                        {me?.role === "ADMIN" ? (
                          /* Stop propagation so delete button doesn't trigger card navigation */
                          <button
                            type="button"
                            title="Move to trash"
                            className="btn-icon-danger"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(project.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="industrial-label">Created</p>
                        <p className="mt-1 font-mono text-sm font-bold text-slate-900">{fmtDate(project.createdAt)}</p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="industrial-label flex items-center gap-1">
                          <CalendarRange className="h-3 w-3" /> Drawing in
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold text-slate-900">{fmtDate(project.drawingReceivedDate)}</p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="industrial-label text-amber-700">Est. Completion</p>
                        <p className="mt-1 font-mono text-sm font-bold text-slate-900">
                          {project.drawingReceivedDate
                            ? fmtDate(project.expectedCompletionDate ?? project.metrics?.expectedCompletionDate)
                            : "Awaiting drawing"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="industrial-label">Days remaining</p>
                        <p className={`font-mono text-2xl font-black ${overdue ? "text-red-600" : "text-slate-900"}`}>
                          {dr === null ? "—" : `${dr} d`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="industrial-label">Overall progress</p>
                        <p className="font-mono text-2xl font-black text-blue-600">{project.metrics.totalProgress.toFixed(1)}%</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="industrial-progress-track">
                        <div
                          className={`industrial-progress-fill ${overdue ? "bg-red-500" : project.status === "COMPLETED" ? "bg-green-500" : "bg-blue-500"}`}
                          style={{ width: `${Math.max(2, project.metrics.totalProgress)}%` }}
                        />
                      </div>
                    </div>

                    {overdue || project.status === "DELAYED" ? (
                      <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span className="text-xs font-semibold">Timeline or stage delay — review control panel</span>
                      </div>
                    ) : null}
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Delete confirmation modal */}
      {confirmDeleteId && me?.role === "ADMIN" ? (
        <div className="erp-modal-overlay">
          <div className="erp-modal">
            <p className="industrial-label">Admin action</p>
            <h3 className="mt-1 text-lg font-black text-slate-900">Move project to Trash?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This project will be hidden from dashboards. You can restore it later from <strong>Trash</strong>.
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
                onClick={async () => {
                  try {
                    setDeleting(true);
                    const r = await fetch(`/api/projects/${confirmDeleteId}`, { method: "DELETE" });
                    const payload = await r.json();
                    if (!r.ok || !payload.success) {
                      setToast({ kind: "error", message: payload.message || "Failed to delete project" });
                      setDeleting(false);
                      return;
                    }
                    setToast({ kind: "success", message: "Project moved to trash" });
                    setConfirmDeleteId(null);
                    setDeleting(false);
                    load();
                  } catch (e) {
                    setDeleting(false);
                    setToast({ kind: "error", message: e instanceof Error ? e.message : "Failed to delete project" });
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting..." : "Move to Trash"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
