"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Toast } from "@/components/Toast";
import { parseEquipmentType } from "@/lib/v5/projectMeta";

type Stage = {
  id: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  progress: number;
  isDelayed: boolean;
  delayReason: string | null;
  stage: { id: string; name: string };
};

type ProjectPayload = {
  id: string;
  projectNo: string;
  clientName: string;
  client?: { name: string } | null;
  equipmentType: string;
  drawingReceivedDate: string | null;
  expectedCompletionDate: string | null;
  updatedAt: string;
  stages: Stage[];
  metrics: { totalProgress: number; daysRemaining: number | null };
};

export default function V5ProjectDetailPage() {
  const params = useParams<{ id: string }>() ?? { id: "" };
  const [project, setProject] = useState<ProjectPayload | null>(null);
  const [drawingDate, setDrawingDate] = useState("");
  const [savingDate, setSavingDate] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  async function load() {
    const response = await fetch(`/api/v5/projects/${params.id}`);
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setToast({ kind: "error", message: payload.message || "Failed to load project" });
      return;
    }
    setProject(payload.data);
    setDrawingDate(payload.data.drawingReceivedDate ? payload.data.drawingReceivedDate.slice(0, 10) : "");
  }

  useEffect(() => {
    if (params.id) load().catch(() => {});
  }, [params.id]);

  const meta = useMemo(() => parseEquipmentType(project?.equipmentType), [project?.equipmentType]);

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 p-4 md:p-6">
      {toast ? <Toast kind={toast.kind} message={toast.message} /> : null}

      {project ? (
        <>
          <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-lg font-bold text-slate-900">{project.projectNo}</p>
                <p className="text-sm text-slate-500">{meta.projectDescription}</p>
              </div>
              <div className="text-right">
                <p className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {project.client?.name ?? project.clientName}
                </p>
                <p className="mt-2 font-mono text-xs text-slate-600">{new Date().toLocaleString()}</p>
              </div>
            </div>
          </header>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Project Timeline</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Description</p>
                <p className="text-sm text-slate-800">{meta.projectDescription}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Machine/Notes</p>
                <p className="text-sm text-slate-800">{meta.projectNotes || "N/A"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Expected completion</p>
                <p className="font-mono text-sm text-slate-800">
                  {project.expectedCompletionDate ? new Date(project.expectedCompletionDate).toLocaleDateString() : "Waiting for drawing"}
                </p>
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-cyan-600" style={{ width: `${Math.max(2, project.metrics.totalProgress)}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-600">
              <span>Progress: {project.metrics.totalProgress.toFixed(1)}%</span>
              <span>Days remaining: {project.metrics.daysRemaining ?? "—"}</span>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Update Drawing Date</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input type="date" value={drawingDate} onChange={(e) => setDrawingDate(e.target.value)} className="rounded-md border border-slate-300 p-2" />
              <button
                disabled={savingDate || !project}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={async () => {
                  if (!project) return;
                  setSavingDate(true);
                  const response = await fetch("/api/project", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: project.id,
                      updatedAt: project.updatedAt,
                      drawingReceivedDate: drawingDate ? new Date(drawingDate).toISOString() : null
                    })
                  });
                  const payload = await response.json();
                  if (!response.ok || !payload.success) {
                    setToast({ kind: "error", message: payload.message || "Failed to update drawing date" });
                    setSavingDate(false);
                    return;
                  }
                  setToast({ kind: "success", message: "Drawing date updated" });
                  setSavingDate(false);
                  await load();
                }}
              >
                {savingDate ? "Saving..." : "Save"}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Production Stages</h2>
            <div className="mt-4 space-y-3">
              {project.stages.map((stage) => (
                <article key={stage.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{stage.stage.name}</p>
                    <p className="font-mono text-sm text-cyan-700">{stage.progress.toFixed(1)}%</p>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-cyan-600" style={{ width: `${Math.max(2, stage.progress)}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
