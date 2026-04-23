"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Toast } from "@/components/Toast";
import { parseEquipmentType } from "@/lib/v5/projectMeta";

type Project = {
  id: string;
  projectNo: string;
  clientName: string;
  client?: { id: string; name: string } | null;
  equipmentType: string;
  createdAt: string;
  status: string;
  metrics: { totalProgress: number };
};

export default function V5DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [me, setMe] = useState<{ role: "ADMIN" | "CLIENT" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  async function load() {
    const [projectsRes, clientsRes, meRes] = await Promise.all([
      fetch("/api/v5/projects"),
      fetch("/api/v5/clients"),
      fetch("/api/auth/me")
    ]);
    const [projectsPayload, clientsPayload, mePayload] = await Promise.all([
      projectsRes.json(),
      clientsRes.json(),
      meRes.json()
    ]);
    if (projectsPayload?.success) setProjects(projectsPayload.data);
    if (clientsPayload?.success) setClients(clientsPayload.data);
    if (mePayload?.success) setMe(mePayload.data);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const filteredClients = useMemo(
    () => clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase())),
    [clients, clientSearch]
  );

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6">
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">V5 Production Dashboard</h1>
        <p className="text-sm text-slate-500">Industrial ERP workspace for project and client operations.</p>
      </header>

      {toast ? <Toast kind={toast.kind} message={toast.message} /> : null}

      {me?.role === "ADMIN" ? (
        <form
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            const fd = new FormData(e.currentTarget);
            const response = await fetch("/api/v5/projects", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                projectNo: String(fd.get("projectNo") || ""),
                projectDescription: String(fd.get("projectDescription") || ""),
                projectNotes: String(fd.get("projectNotes") || ""),
                clientId: selectedClientId
              })
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) {
              setToast({ kind: "error", message: payload.message || "Failed to create project" });
              setSaving(false);
              return;
            }
            setToast({ kind: "success", message: "Project created successfully" });
            e.currentTarget.reset();
            setSelectedClientId("");
            setClientSearch("");
            setSaving(false);
            await load();
          }}
        >
          <div className="grid gap-4 border-b border-slate-200 pb-4 md:grid-cols-12">
            <input
              required
              autoFocus
              name="projectNo"
              placeholder="Project No"
              className="md:col-span-2 rounded-xl border border-slate-300 p-3 text-lg font-bold"
            />
            <input
              required
              name="projectDescription"
              placeholder="Project Description"
              className="md:col-span-4 rounded-xl border border-slate-300 p-3 text-sm"
            />
            <input name="projectNotes" placeholder="Machine Type / Notes" className="md:col-span-3 rounded-xl border border-slate-300 p-3 text-sm" />
            <div className="md:col-span-3 space-y-2">
              <input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search client"
                className="w-full rounded-xl border border-slate-300 p-3 text-sm"
              />
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
              >
                <option value="">Select client</option>
                {filteredClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              disabled={saving || !selectedClientId}
              className="rounded-xl bg-slate-900 px-5 py-2 font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {projects.map((project) => {
          const meta = parseEquipmentType(project.equipmentType);
          return (
            <article key={project.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                <div>
                  <p className="text-lg font-bold text-slate-900">{project.projectNo}</p>
                  <p className="text-sm text-slate-500">{meta.projectDescription}</p>
                </div>
                <div className="text-right">
                  <p className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{project.client?.name ?? project.clientName}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{new Date(project.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4">
                <p className="text-xs text-slate-500">{meta.projectNotes || "No secondary notes"}</p>
                <p className="font-mono text-sm font-bold text-cyan-700">{project.metrics.totalProgress.toFixed(1)}%</p>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-cyan-600" style={{ width: `${Math.max(2, project.metrics.totalProgress)}%` }} />
              </div>
              <div className="mt-4">
                <Link href={`/v5/project/${project.id}`} className="text-sm font-semibold text-cyan-700 hover:text-cyan-600">
                  Open project
                </Link>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
