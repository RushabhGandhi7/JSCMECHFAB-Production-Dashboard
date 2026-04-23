import { listProjects } from "@/lib/services/project.service";
import { AlertTriangle, Gauge } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

export default async function ShopFloorPage() {
  const projects = await listProjects();
  return (
    <main className="min-h-screen bg-white p-6 text-slate-900 md:p-10">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Shop floor</p>
        <h1 className="text-5xl font-black tracking-tight md:text-6xl">Production broadcast</h1>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        {projects.map((project) => {
          const metrics = project.metrics;
          const dr = metrics.daysRemaining;
          const critical = (dr !== null && dr < 0) || project.status === "DELAYED";
          return (
            <article key={project.id} className="rounded-2xl border-2 border-slate-200 bg-white p-8 shadow-xl">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg uppercase tracking-widest text-slate-500">Project</p>
                  <h2 className="font-mono text-6xl font-black text-slate-900 md:text-7xl">{project.projectNo}</h2>
                </div>
                <StatusBadge value={project.status} />
              </div>

              <p className="mb-8 text-3xl font-semibold text-slate-600">{project.clientName}</p>

              <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
                <p className="mb-2 flex items-center gap-3 text-2xl text-slate-500">
                  <Gauge className="h-8 w-8 text-cyan-700" />
                  Current stage
                </p>
                <p className="text-4xl font-bold text-cyan-700 md:text-5xl">{metrics.currentStage}</p>
              </div>

              <p className="font-mono text-8xl font-black leading-none text-cyan-700 md:text-9xl">{metrics.totalProgress.toFixed(0)}%</p>
              <div className="mt-4 h-6 rounded-full bg-slate-200">
                <div className="h-6 rounded-full bg-cyan-600 transition-all duration-500" style={{ width: `${Math.max(3, metrics.totalProgress)}%` }} />
              </div>

              {critical ? (
                <div className="mt-8 flex items-center gap-4 rounded-xl border-2 border-red-200 bg-red-50 p-5 text-red-700">
                  <AlertTriangle className="h-12 w-12 shrink-0" />
                  <div>
                    <p className="text-3xl font-black">Critical delay</p>
                    <p className="text-xl text-red-600">{dr !== null && dr < 0 ? `${Math.abs(dr)} days over target` : "Review production status"}</p>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </main>
  );
}
