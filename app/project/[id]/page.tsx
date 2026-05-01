"use client";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  ClipboardList, Gauge, Hammer, History, MessageSquare,
  Package, Pencil, Plus, Save, Settings, Timer, Truck, Trash, Wrench
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Toast } from "@/components/Toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";

// ─── Constants ────────────────────────────────────────────────────────────────

const THICKNESS_OPTIONS = [
  "2mm","4mm","6mm","8mm","10mm","12mm","14mm","16mm","18mm","20mm"
] as const;

const SHEET_SIZE_OPTIONS = ["1250x2500","1500x3000"] as const;

const DELAY_OPTIONS = [
  "Material delay","Vendor delay","Rework",
  "Quality issue","Machine breakdown","Other"
];

/**
 * Production schedule segments.  Each matchKey is a lowercase substring of
 * the actual ProductionStage.name values from the DB seeder:
 *   Drawing & Design | Procurement | Cutting | Machining |
 *   Fabrication | Assembly | Testing | Dispatch
 *
 * proportions are expressed as fractions of a 28-day cycle that scale
 * linearly to whatever productionDurationDays the project uses.
 */
const PRODUCTION_TIMELINE_SEGMENTS = [
  { label: "Drawing & Design", startDay: 1,  endDay: 4,  matchKey: "drawing"     },
  { label: "Procurement",      startDay: 4,  endDay: 7,  matchKey: "procurement" },
  { label: "Cutting",          startDay: 7,  endDay: 10, matchKey: "cutting"     },
  { label: "Machining",        startDay: 10, endDay: 13, matchKey: "machining"   },
  { label: "Fabrication",      startDay: 13, endDay: 19, matchKey: "fabrication" },
  { label: "Assembly",         startDay: 19, endDay: 23, matchKey: "assembly"    },
  { label: "Testing",          startDay: 23, endDay: 26, matchKey: "testing"     },
  { label: "Dispatch",         startDay: 26, endDay: 28, matchKey: "dispatch"    }
] as const;

/** Gantt bar gradient class based on segment status. */
const GANTT_COLOURS = {
  completed:   "bg-gradient-to-r from-green-400 to-green-600",
  in_progress: "bg-gradient-to-r from-blue-400 to-blue-600",
  delayed:     "bg-gradient-to-r from-red-400 to-red-600",
  upcoming:    "bg-slate-200"
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcurementEntry {
  id: string;
  materialType: "MS" | "SS";
  thickness: string;
  quantity: number;
  sheetSize: string;
  actionType: "ORDERED" | "RECEIVED";
  status: string;
  timestamp: string;
  updatedBy: string;
}

type SegStatus = "completed" | "delayed" | "in_progress" | "upcoming";

type DetailType = "drawing" | "procurement" | "cutting" | "machining" | null;

type ProjectPayload = any;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function fmtShortDate(d: Date) {
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

/**
 * Add N days to base, skipping Sundays if excludeSundays is true.
 * Mirrors lib/project-timeline.ts addWorkingDays for consistent UI dates.
 */
function addWorkingDays(base: Date, days: number, excludeSundays: boolean): Date {
  if (!excludeSundays || days <= 0) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }
  const d = new Date(base);
  let count = 0;
  while (count < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0) count++;
  }
  return d;
}

function progressTone(p: number) {
  if (p >= 99) return "bg-green-500";
  if (p > 0)   return "bg-yellow-500";
  return "bg-slate-600";
}

function statusLeftBorder(status: string, delayed: boolean) {
  if (delayed || status === "DELAYED") return "border-l-red-500";
  if (status === "COMPLETED")          return "border-l-green-500";
  if (status === "IN_PROGRESS")        return "border-l-blue-500";
  return "border-l-slate-300";
}

function stageIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("drawing") || n.includes("design")) return Pencil;
  if (n.includes("fabrication"))                     return Settings;
  if (n.includes("assembly"))                        return Wrench;
  if (n.includes("testing"))                         return CheckCircle;
  if (n.includes("dispatch"))                        return Truck;
  if (n.includes("procurement"))                     return Package;
  return Gauge;
}

function timelinePosition(project: any) {
  const start  = project.drawingReceivedDate ? new Date(project.drawingReceivedDate).getTime() : null;
  const endIso = project.expectedCompletionDate || project.metrics?.expectedCompletionDate;
  const end    = endIso ? new Date(endIso).getTime() : null;
  if (!start || !end || end <= start) return { pct: 0, overdue: false, hasWindow: false };
  const now = Date.now();
  return {
    pct: Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)),
    overdue: now > end,
    hasWindow: true
  };
}

function getDetailType(stageName: string): DetailType {
  const n = stageName.toLowerCase();
  if (n.includes("drawing") || n.includes("design")) return "drawing";
  if (n.includes("procurement"))                     return "procurement";
  if (n.includes("machining"))                       return "machining";  // independent stage
  if (n.includes("cutting") || n.includes("bending")) return "cutting";
  return null;
}

// ─── Default procurement form state ──────────────────────────────────────────

const defaultProcForm = () => ({
  materialType: "MS" as "MS" | "SS",
  thickness: "" as string,
  quantity: "",
  sheetSize: "",
  actionType: "ORDERED" as "ORDERED" | "RECEIVED"
});

/**
 * Derives the correct StageStatus from a raw progress number.
 * 0 → NOT_STARTED | 1-99 → IN_PROGRESS | 100 → COMPLETED
 */
function deriveStatus(progress: number): "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" {
  if (progress >= 100) return "COMPLETED";
  if (progress > 0)    return "IN_PROGRESS";
  return "NOT_STARTED";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const { id } = resolvedParams;

  // ── Core state ─────────────────────────────────────────────────────────────
  const [project, setProject]               = useState<ProjectPayload | null>(null);
  const [error, setError]                   = useState("");
  const [updatingId, setUpdatingId]         = useState<string | null>(null);
  const [toast, setToast]                   = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const [me, setMe]                         = useState<{ role: "ADMIN" | "CLIENT"; clientName: string; email?: string } | null>(null);

  // ── Project-level settings ─────────────────────────────────────────────────
  const [drawingInput, setDrawingInput]         = useState("");
  const [durationInput, setDurationInput]       = useState(28);
  const [excludeSundaysInput, setExcludeSundaysInput] = useState(false);

  // ── Stage form state ───────────────────────────────────────────────────────
  const [selectedStageId, setSelectedStageId] = useState("");
  const [quickUpdate, setQuickUpdate]         = useState({ progress: 0, status: "NOT_STARTED", delayReason: "" });
  const [stageDetails, setStageDetails]       = useState<Record<string, unknown>>({});
  const [saveGlow, setSaveGlow]               = useState(false);

  // ── Procurement add-entry form ─────────────────────────────────────────────
  const [procForm, setProcForm]             = useState(defaultProcForm());
  const [addingProc, setAddingProc]         = useState(false);
  const [procFormOpen, setProcFormOpen]     = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [logExpanded, setLogExpanded]         = useState(true);
  const [confirmDelete, setConfirmDelete]     = useState(false);
  const [deleting, setDeleting]               = useState(false);
  const [confirmDispatch, setConfirmDispatch] = useState(false);
  const [dispatching, setDispatching]         = useState(false);
  /** Stage ID briefly highlighted with green ring after a successful save. */
  const [changedStageId, setChangedStageId]   = useState<string | null>(null);
  /** Index into PRODUCTION_TIMELINE_SEGMENTS whose Gantt bar is being hovered. */
  const [hoveredGanttIdx, setHoveredGanttIdx] = useState<number | null>(null);

  // ── Remarks state ─────────────────────────────────────────────────────────
  const [remarks, setRemarks]               = useState<any[]>([]);
  const [remarkText, setRemarkText]         = useState("");
  const [remarkStageId, setRemarkStageId]   = useState("");
  const [submittingRemark, setSubmittingRemark] = useState(false);

  // ── Procurement items (from new relational table) ───────────────────────
  const [procItems, setProcItems]           = useState<any[]>([]);
  const [procExpanded, setProcExpanded]     = useState<string | null>(null);

  // ── Electrical panels state ─────────────────────────────────────────
  const [panels, setPanels]                 = useState<any[]>([]);
  const [panelForm, setPanelForm]           = useState({ panelName: "", assignedTo: "", remarks: "" });
  const [addingPanel, setAddingPanel]       = useState(false);
  const [panelFormOpen, setPanelFormOpen]   = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  async function load(projectId: string) {
    try {
      const res     = await fetch(`/api/projects/${projectId}`);
      const payload = await res.json();
      if (!res.ok || !payload.success) return setError(payload.message ?? "Failed to load project");
      setProject(payload.data);
    } catch (e) {
      setError("Failed to load project");
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  useEffect(() => { load(id); }, [id]);

  async function loadRemarks(projectId: string) {
    try {
      const r = await fetch(`/api/remarks?projectId=${projectId}`);
      const p = await r.json();
      if (p.success) setRemarks(p.data.reverse()); // latest first
    } catch {}
  }

  async function loadProcItems(projectId: string) {
    try {
      const r = await fetch(`/api/procurement?projectId=${projectId}`);
      const p = await r.json();
      if (p.success) setProcItems(p.data);
    } catch {}
  }

  async function loadPanels(projectId: string) {
    try {
      const r = await fetch(`/api/electrical-panels?projectId=${projectId}`);
      const p = await r.json();
      if (p.success) setPanels(p.data);
    } catch {}
  }

  async function submitRemark() {
    if (!remarkText.trim() || !project) return;
    setSubmittingRemark(true);
    try {
      const body: Record<string, string> = { projectId: project.id, message: remarkText.trim() };
      if (remarkStageId) body.projectStageId = remarkStageId;
      const r = await fetch("/api/remarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const p = await r.json();
      if (p.success) {
        setRemarkText("");
        setRemarkStageId("");
        setToast({ kind: "success", message: "Remark submitted" });
        loadRemarks(project.id);
      } else {
        setToast({ kind: "error", message: p.message ?? "Failed to submit remark" });
      }
    } catch (e) {
      setToast({ kind: "error", message: "Failed to submit remark" });
    }
    setSubmittingRemark(false);
}

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => { if (p?.success) setMe(p.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (project?.id) {
      loadRemarks(project.id);
      loadProcItems(project.id);
      loadPanels(project.id);
    }
  }, [project?.id]);



  // Sync all form controls when project refreshes.
  // selectedStageId is listed as a dependency to avoid stale-closure bugs
  // where the effect captures an outdated ID and falls back to the first stage.
  useEffect(() => {
    if (!project?.stages?.length) return;

    const dr = project.drawingReceivedDate
      ? new Date(project.drawingReceivedDate).toISOString().slice(0, 10)
      : "";
    setDrawingInput(dr);
    setDurationInput((project as any).productionDurationDays ?? 28);
    setExcludeSundaysInput((project as any).excludeSundays ?? false);

    const first = project.stages[0];
    const sel   = selectedStageId && project.stages.some((s: any) => s.id === selectedStageId)
      ? selectedStageId : first.id;
    const stage = project.stages.find((s: any) => s.id === sel) ?? first;

    setSelectedStageId(stage.id);
    setQuickUpdate({ progress: Number(stage.progress ?? 0), status: stage.status, delayReason: stage.delayReason ?? "" });
    setStageDetails((stage.stageDetails as Record<string, unknown>) ?? {});
  }, [project, selectedStageId]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const selectedStage = useMemo(
    () => project?.stages?.find((s: any) => s.id === selectedStageId),
    [project, selectedStageId]
  );

  const timeline = useMemo(
    () => project ? timelinePosition(project) : { pct: 0, overdue: false, hasWindow: false },
    [project]
  );

  const totalDays = useMemo(
    () => (project as any)?.productionDurationDays ?? 28,
    [project]
  );

  const excSundays = useMemo(
    () => (project as any)?.excludeSundays ?? false,
    [project]
  );

  /** 7-phase schedule with planned dates scaled to project's production window.
   *  When a COMPLETED stage has an actualDate later than its plannedEnd, all
   *  downstream phases are shifted forward by that delay (cascading effect).
   */
  const plannedSchedule = useMemo(() => {
    if (!project?.drawingReceivedDate) return null;
    const base = new Date(project.drawingReceivedDate);
    const now  = new Date();
    let cumulativeShiftDays = 0; // propagates delays to downstream phases

    return PRODUCTION_TIMELINE_SEGMENTS.map((seg) => {
      // Scale proportionally from standard 28-day template
      const scaledStart = Math.round((seg.startDay - 1) / 28 * totalDays);
      const scaledEnd   = Math.round(seg.endDay / 28 * totalDays);

      const plannedStart = addWorkingDays(base, scaledStart + cumulativeShiftDays, excSundays);
      const plannedEnd   = addWorkingDays(base, scaledEnd   + cumulativeShiftDays, excSundays);

      const matchedStage = seg.matchKey
        ? project.stages?.find((s: any) => s.stage?.name?.toLowerCase().includes(seg.matchKey))
        : null;

      // If this stage completed with an actualDate, propagate any overrun to downstream
      const actualDate = matchedStage?.actualDate ? new Date(matchedStage.actualDate) : null;
      if (matchedStage?.status === "COMPLETED" && actualDate) {
        const diffDays = Math.round((actualDate.getTime() - plannedEnd.getTime()) / 86_400_000);
        if (diffDays > 0) cumulativeShiftDays += diffDays; // positive = late → shift downstream
      }

      // Status: delayReason OR isDelayed both trigger red in the timeline
      let segStatus: SegStatus = "upcoming";
      if (matchedStage?.status === "COMPLETED")                               segStatus = "completed";
      else if (matchedStage?.isDelayed || matchedStage?.delayReason)          segStatus = "delayed";
      else if (now > plannedEnd && matchedStage?.status !== "NOT_STARTED")    segStatus = "delayed";
      else if (now >= plannedStart || matchedStage?.status === "IN_PROGRESS") segStatus = "in_progress";

      return { ...seg, scaledStart, scaledEnd, plannedStart, plannedEnd, segStatus, matchedStage };
    });
  }, [project?.drawingReceivedDate, project?.stages, totalDays, excSundays]);

  /** Gantt bar positions. Colour driven by same status logic as timeline table. */
  const ganttBars = useMemo(() => {
    if (!project?.stages) return null;
    return PRODUCTION_TIMELINE_SEGMENTS.map((seg) => {
      const leftPct  = (seg.startDay - 1) / 28 * 100;
      const widthPct = (seg.endDay - seg.startDay + 1) / 28 * 100;

      const matchedStage = seg.matchKey
        ? project.stages.find((s: any) => s.stage?.name?.toLowerCase().includes(seg.matchKey))
        : null;

      // Mirror the same status logic used in plannedSchedule
      let segStatus: SegStatus = "upcoming";
      if (matchedStage?.status === "COMPLETED")                      segStatus = "completed";
      else if (matchedStage?.isDelayed || matchedStage?.delayReason) segStatus = "delayed";
      else if (matchedStage?.status === "IN_PROGRESS")               segStatus = "in_progress";

      return {
        ...seg, leftPct, widthPct, matchedStage, segStatus,
        progress:   matchedStage?.progress   ?? 0,
        actualDate: matchedStage?.actualDate  ?? null
      };
    });
  }, [project?.stages]);

  /** Progress logs for the selected stage. */
  const stageLogs = useMemo(() => {
    if (!project?.stageProgressLogs || !selectedStageId) return [];
    return (project.stageProgressLogs as any[]).filter((l: any) => l.projectStageId === selectedStageId);
  }, [project?.stageProgressLogs, selectedStageId]);

  /** Detail sub-form type for the selected stage. */
  const detailType = useMemo(
    () => selectedStage ? getDetailType(selectedStage.stage?.name ?? "") : null,
    [selectedStage]
  );

  /** Procurement log entries extracted from stageDetails. */
  const procurementLog = useMemo((): ProcurementEntry[] => {
    if (detailType !== "procurement") return [];
    const details = selectedStage?.stageDetails as Record<string, unknown> | null;
    const log = details?.procurementLog;
    return Array.isArray(log) ? (log as ProcurementEntry[]) : [];
  }, [selectedStage?.stageDetails, detailType]);

  /** Aggregate totals for procurement summary cards. */
  const procSummary = useMemo(() => {
    const totalOrdered  = procurementLog.filter(e => e.actionType === "ORDERED").reduce((n, e) => n + e.quantity, 0);
    const totalReceived = procurementLog.filter(e => e.actionType === "RECEIVED").reduce((n, e) => n + e.quantity, 0);
    return { totalOrdered, totalReceived, pending: Math.max(0, totalOrdered - totalReceived) };
  }, [procurementLog]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function selectStage(stage: any) {
    setSelectedStageId(stage.id);
    setQuickUpdate({ progress: stage.progress, status: stage.status, delayReason: stage.delayReason ?? "" });
    setStageDetails((stage.stageDetails as Record<string, unknown>) ?? {});
    setProcFormOpen(false);
  }

  async function handleAddProcurement() {
    if (!procForm.thickness) { setToast({ kind: "error", message: "Select a thickness" }); return; }
    if (!procForm.quantity || Number(procForm.quantity) < 1) { setToast({ kind: "error", message: "Enter a valid quantity" }); return; }
    setAddingProc(true);
    try {
      const res = await fetch("/api/project-stage/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectStageId: selectedStageId,
          materialType:   procForm.materialType,
          thickness:      procForm.thickness,
          quantity:       Number(procForm.quantity),
          sheetSize:      procForm.sheetSize || undefined,
          actionType:     procForm.actionType
        })
      });
      const payload = await res.json();
      setToast({ message: payload.success ? "Material entry added" : payload.message, kind: payload.success ? "success" : "error" });
      if (payload.success) { setProcForm(defaultProcForm()); setProcFormOpen(false); await load(id); }
    } catch (e) {
      setToast({ kind: "error", message: "Failed to add material entry" });
    }
    setAddingProc(false);
  }

  // ── Render guards ─────────────────────────────────────────────────────────
  if (error)    return <main className="p-6 text-red-700">{error}</main>;
  if (!project) return <main className="p-6"><LoadingSpinner label="Loading production control panel..." /></main>;

  const dr              = project.metrics.daysRemaining;
  const overdueTimeline = dr !== null && dr < 0;
  const delayedStages   = project.stages.filter((s: any) => s.isDelayed);

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <main className="mx-auto max-w-[1700px] space-y-5 bg-[#f8fafc] p-4 md:p-6">

      {/* ── Sticky project header ─────────────────────────────────────────── */}
      <header className="industrial-card sticky top-3 z-20 overflow-hidden rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <p className="font-mono text-2xl font-black tracking-tight text-slate-900">{project.projectNo}</p>
            <p className="mt-1 text-sm text-slate-600">{project.equipmentType}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-slate-900">{project.client?.name ?? project.clientName}</p>
            <p className="mt-1 font-mono text-sm text-slate-700">{fmtDateTime(project.createdAt)}</p>
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <p className="industrial-label">Drawing received</p>
                <p className="font-mono text-base font-semibold text-slate-900">{fmtDate(project.drawingReceivedDate)}</p>
              </div>
              <div>
                <p className="industrial-label">Expected completion</p>
                <p className="font-mono text-base font-semibold text-yellow-700">
                  {project.drawingReceivedDate
                    ? fmtDate(project.expectedCompletionDate || project.metrics?.expectedCompletionDate)
                    : "Waiting for drawing"}
                </p>
              </div>
              <div>
                <p className="industrial-label">Duration / Sundays</p>
                <p className="font-mono text-base font-semibold text-slate-700">
                  {(project as any).productionDurationDays ?? 28}d / {(project as any).excludeSundays ? "Excluded" : "Included"}
                </p>
              </div>
              <div>
                <p className="industrial-label">Days remaining</p>
                <p className={`font-mono text-2xl font-black ${overdueTimeline ? "text-red-600" : "text-slate-900"}`}>
                  {dr === null ? "—" : `${dr} d`}
                </p>
              </div>
              <div>
                <p className="industrial-label">Overall</p>
                <p className="font-mono text-2xl font-black text-cyan-700">{project.metrics.totalProgress.toFixed(1)}%</p>
                <div className="mt-1"><StatusBadge value={project.status} /></div>
              </div>
              {/* Admin-only: Total procurement weight */}
              {me?.role === "ADMIN" && procItems.some((i: any) => i.weightKg) && (
                <div>
                  <p className="industrial-label">Total Weight</p>
                  <p className="font-mono text-2xl font-black text-emerald-700">
                    {procItems.reduce((s: number, i: any) => s + (i.weightKg ?? 0), 0).toFixed(1)}{" "}
                    <span className="text-sm font-semibold text-emerald-600">kg</span>
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-slate-400">
                    Rcvd: {procItems.filter((i: any) => i.status === "RECEIVED").reduce((s: number, i: any) => s + (i.weightKg ?? 0), 0).toFixed(1)} kg
                  </p>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {me?.role === "CLIENT" && (
                <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700">VIEW ONLY</span>
              )}
              {me?.role === "ADMIN" && (
                <div className="flex shrink-0 items-center gap-2">
                  {project.metrics.totalProgress >= 100 && project.status !== "DISPATCHED" && (
                    <button type="button" disabled={dispatching} className="flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50" onClick={() => setConfirmDispatch(true)}>
                      <Truck className="h-4 w-4" /> Mark as Dispatched
                    </button>
                  )}
                  <button type="button" className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700 hover:bg-red-100" onClick={() => setConfirmDelete(true)}>
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {toast ? <Toast message={toast.message} kind={toast.kind} /> : null}

      {/* ── Main grid ─────────────────────────────────────────────────────── */}
      <section className="grid gap-5 xl:grid-cols-10">

        {/* Left column */}
        <div className="space-y-5 xl:col-span-7">

          {/* ── Production Timeline (bar + phase table) ─────────────────── */}
          <article className="industrial-card rounded-xl p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
                <Timer className="h-5 w-5 text-cyan-700" />
                {totalDays}-Day Production Timeline
              </h2>
              {timeline.hasWindow && timeline.overdue && (
                <span className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-sm font-bold text-red-700">
                  <AlertTriangle className="h-4 w-4" /> Behind schedule
                </span>
              )}
            </div>

            {!project.drawingReceivedDate ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                Set the <strong>Drawing Received Date</strong> and <strong>Production Duration</strong> in the Control Panel to activate the timeline.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Overall progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs uppercase tracking-wide text-slate-500">
                    <span>Drawing in</span><span>Target completion</span>
                  </div>
                  <div className="relative h-5 overflow-hidden rounded-full bg-slate-200">
                    <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ${timeline.overdue ? "bg-red-500" : "bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600"}`} style={{ width: `${timeline.pct}%` }} />
                    <div className="absolute top-0 h-full w-1.5 -translate-x-1/2 animate-pulse bg-white/70" style={{ left: `${Math.min(100, timeline.pct)}%` }} />
                  </div>
                </div>

                {/* Phase table with scaled dates */}
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-3 py-2.5 text-left text-[0.67rem] font-bold uppercase tracking-wider text-slate-500">Phase</th>
                        <th className="px-3 py-2.5 text-left text-[0.67rem] font-bold uppercase tracking-wider text-slate-500">Days</th>
                        <th className="px-3 py-2.5 text-left text-[0.67rem] font-bold uppercase tracking-wider text-slate-500">Planned Start</th>
                        <th className="px-3 py-2.5 text-left text-[0.67rem] font-bold uppercase tracking-wider text-slate-500">Planned End</th>
                        <th className="px-3 py-2.5 text-left text-[0.67rem] font-bold uppercase tracking-wider text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plannedSchedule!.map((seg, i) => (
                        <tr key={i} className={`border-t border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                          <td className="px-3 py-2.5 font-semibold text-slate-800">{seg.label}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-400">D{seg.scaledStart + 1}–D{seg.scaledEnd}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{fmtShortDate(seg.plannedStart)}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{fmtShortDate(seg.plannedEnd)}</td>
                          <td className="px-3 py-2.5">
                            {seg.segStatus === "completed"   && <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">✓ Completed</span>}
                            {seg.segStatus === "delayed"     && <span className="inline-flex items-center gap-1 rounded-full bg-red-100   px-2.5 py-0.5 text-xs font-bold text-red-700">⚠ Delayed</span>}
                            {seg.segStatus === "in_progress" && <span className="inline-flex items-center gap-1 rounded-full bg-blue-100  px-2.5 py-0.5 text-xs font-bold text-blue-700">● In Progress</span>}
                            {seg.segStatus === "upcoming"    && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500">○ Upcoming</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </article>

          {/* ── Gantt Chart ─────────────────────────────────────────────────── */}
          <article className="industrial-card rounded-xl p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-slate-900">
              <Timer className="h-5 w-5 text-cyan-700" />
              Production Gantt Chart
            </h2>

            {!ganttBars ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <div className="space-y-1">
                {/* Legend */}
                <div className="mb-3 flex flex-wrap items-center gap-3 text-xs font-semibold">
                  {[["bg-green-500","Completed"],["bg-blue-500","In Progress"],["bg-red-500","Delayed"],["bg-slate-300","Upcoming"]].map(([cls,lbl]) => (
                    <span key={lbl} className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-6 rounded-sm ${cls}`} />
                      <span className="text-slate-600">{lbl}</span>
                    </span>
                  ))}
                  {timeline.hasWindow && (
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="h-4 w-0.5 bg-red-400 rounded" />
                      <span className="text-slate-500">Today</span>
                    </span>
                  )}
                </div>

                {/* Bars */}
                <div className="relative">
                  {/* Today vertical line (spans all rows) */}
                  {timeline.hasWindow && (
                    <div
                      className="pointer-events-none absolute top-0 bottom-8 z-20 w-0.5 bg-red-400"
                      style={{ left: `calc(9rem + ${timeline.pct}% * (100% - 9rem) / 100)` }}
                    >
                      <span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap rounded bg-red-400 px-1 py-0.5 text-[0.6rem] font-bold text-white">Today</span>
                    </div>
                  )}

                  {ganttBars.map((bar, i) => {
                    const sched = plannedSchedule ? plannedSchedule[i] : null;
                    return (
                      <div
                        key={i}
                        className="relative mb-1.5 flex items-center gap-2"
                        onMouseEnter={() => setHoveredGanttIdx(i)}
                        onMouseLeave={() => setHoveredGanttIdx(null)}
                      >
                        {/* Stage label */}
                        <span className="w-36 shrink-0 text-right text-xs font-semibold text-slate-600 leading-tight">{bar.label}</span>

                        {/* Bar track — overflow-hidden clips bars; tooltip is a sibling outside */}
                        <div className="relative h-9 flex-1 overflow-hidden rounded-md bg-slate-100">
                          {/* Segment bar */}
                          <div
                            className={`absolute top-1 bottom-1 rounded ${GANTT_COLOURS[bar.segStatus]} opacity-90 transition-all duration-500`}
                            style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}
                          >
                            {/* Progress overlay (lighter shade) */}
                            {bar.progress > 0 && bar.segStatus !== "completed" && (
                              <div className="absolute left-0 top-0 h-full rounded bg-white/30" style={{ width: `${bar.progress}%` }} />
                            )}
                            {/* Progress text */}
                            <span className="absolute inset-0 flex items-center pl-1.5 text-[0.62rem] font-bold text-white drop-shadow truncate">
                              {bar.progress > 0 ? `${bar.progress}%` : ""}
                            </span>
                          </div>
                        </div>

                        {/* ── Rich hover tooltip ──────────────────────────── */}
                        {hoveredGanttIdx === i && sched && (
                          <div className="pointer-events-none absolute bottom-9 left-36 z-30 min-w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl text-xs">
                            <p className="mb-2 font-bold text-slate-900">{bar.label}</p>
                            <div className="space-y-1 text-slate-600">
                              <div className="flex justify-between gap-4">
                                <span>Planned start</span>
                                <span className="font-semibold text-slate-800">{fmtShortDate(sched.plannedStart)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span>Planned end</span>
                                <span className="font-semibold text-slate-800">{fmtShortDate(sched.plannedEnd)}</span>
                              </div>
                              {bar.actualDate && (
                                <div className="flex justify-between gap-4">
                                  <span>Actual end</span>
                                  <span className="font-semibold text-green-600">{fmtShortDate(new Date(bar.actualDate))}</span>
                                </div>
                              )}
                              <div className="flex justify-between gap-4">
                                <span>Progress</span>
                                <span className={`font-bold ${
                                  bar.progress >= 100 ? "text-green-600"
                                  : bar.segStatus === "delayed" ? "text-red-600"
                                  : "text-blue-600"
                                }`}>{bar.progress}%</span>
                              </div>
                            </div>
                            {sched.segStatus === "delayed" && (
                              <p className="mt-2 font-bold text-red-600">⚠ Delayed</p>
                            )}
                            {sched.segStatus === "completed" && (
                              <p className="mt-2 font-bold text-green-600">✓ Completed</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Day axis */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="w-36 shrink-0" />
                    <div className="flex flex-1 justify-between text-[0.65rem] font-mono text-slate-400">
                      <span>D1</span>
                      <span>D{Math.ceil(totalDays / 4)}</span>
                      <span>D{Math.ceil(totalDays / 2)}</span>
                      <span>D{Math.ceil(totalDays * 3 / 4)}</span>
                      <span>D{totalDays}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </article>

          {/* ── Production stage cards ───────────────────────────────────── */}
          <article className="industrial-card rounded-xl p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-slate-900">
              <Gauge className="h-5 w-5 text-cyan-700" />
              Production Stages
            </h2>
            <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
              {project.stages.map((stage: any) => {
                const active     = stage.id === selectedStageId;
                const justSaved  = changedStageId === stage.id;
                const Icon       = stageIcon(stage.stage.name);
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => selectStage(stage)}
                    className={`flex flex-col rounded-xl border-2 border-l-4 p-4 text-left transition-all duration-200 hover:shadow-md min-h-[120px]
                      ${active    ? "border-cyan-400 bg-cyan-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}
                      ${justSaved ? "ring-2 ring-green-400 ring-offset-2 shadow-lg" : ""}
                      ${statusLeftBorder(stage.status, stage.isDelayed || !!stage.delayReason)}`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                        <Icon className="h-4 w-4 shrink-0 text-slate-600" />
                        {stage.stage.name}
                      </p>
                      {(stage.isDelayed || stage.delayReason) && <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />}
                    </div>
                    <div className="industrial-progress-track">
                      <div className={`industrial-progress-fill ${progressTone(stage.progress)}`} style={{ width: `${Math.max(stage.progress, 2)}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <StatusBadge value={stage.status} />
                      <span className="font-mono text-sm font-semibold text-slate-700">{stage.progress}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </article>

          {/* ── Stage detail view (contextual for procurement) ───────────── */}
          <article className="industrial-card rounded-xl bg-slate-50 p-5">
            <h3 className="mb-3 text-lg font-black text-slate-900">
              Stage Detail — {selectedStage?.stage?.name ?? ""}
            </h3>

            {/* ── PROCUREMENT: summary + log ─────────────────────────────── */}
            {detailType === "procurement" ? (
              <div className="space-y-4">
                {/* KPI strip */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Items",    value: procItems.length,                                         cls: "border-blue-200 bg-blue-50",   txt: "text-blue-700"  },
                    { label: "Received",       value: procItems.filter((i:any) => i.status==="RECEIVED").length, cls: "border-green-200 bg-green-50", txt: "text-green-700" },
                    { label: "Pending/Ordered",value: procItems.filter((i:any) => i.status!=="RECEIVED").length, cls: "border-amber-200 bg-amber-50",  txt: "text-amber-700" },
                  ].map(({ label, value, cls, txt }) => (
                    <div key={label} className={`rounded-xl border p-3 text-center ${cls}`}>
                      <p className="text-[0.67rem] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                      <p className={`mt-1 text-2xl font-black ${txt}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Weight summary — admin only */}
                {me?.role === "ADMIN" && procItems.some((i:any) => i.weightKg) && (
                  <div className="flex flex-wrap gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm">
                    <span className="font-semibold text-emerald-700">Total ordered wt.: <strong>{procItems.reduce((s:number,i:any)=>s+(i.weightKg??0),0).toFixed(1)} kg</strong></span>
                    <span className="font-semibold text-green-700">Received wt.: <strong>{procItems.filter((i:any)=>i.status==="RECEIVED").reduce((s:number,i:any)=>s+(i.weightKg??0),0).toFixed(1)} kg</strong></span>
                  </div>
                )}

                {procItems.length === 0 ? (
                  <div className="erp-empty py-6">
                    <Package className="erp-empty-icon h-8 w-8" />
                    <p className="erp-empty-title text-sm">No procurement entries</p>
                    <p className="erp-empty-sub">Add items via the <a href="/procurement" className="text-blue-600 underline">Procurement module</a>.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-left">
                          {["Category","Material","Type","Specs","Qty",
                            ...(me?.role==="ADMIN" ? ["Weight"] : []),
                            "Status","Date"
                          ].map(h =>
                            <th key={h} className="px-3 py-2.5 text-[0.67rem] font-bold uppercase tracking-wider text-slate-500">{h}</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {procItems.map((item: any, idx: number) => (
                          <React.Fragment key={item.id}>
                            <tr
                              className={`border-t border-slate-100 cursor-pointer ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"} ${item.status === "RECEIVED" ? "border-l-4 border-l-green-400" : item.status === "ORDERED" ? "border-l-4 border-l-blue-400" : "border-l-4 border-l-amber-400"}`}
                              onClick={() => setProcExpanded(procExpanded === item.id ? null : item.id)}
                            >
                              <td className="px-3 py-2.5 text-xs font-bold text-slate-600">{item.category.replace("_"," ")}</td>
                              <td className="px-3 py-2.5 font-semibold text-slate-800">{item.materialName}</td>
                              <td className="px-3 py-2.5"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-700">{item.materialType}</span></td>
                              <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{[item.thickness?`${item.thickness}mm`:null, item.lengthMm&&item.widthMm?`${item.lengthMm}×${item.widthMm}mm`:null].filter(Boolean).join(" · ") || "—"}</td>
                              <td className="px-3 py-2.5 font-mono font-bold">{item.quantity} <span className="text-xs font-normal text-slate-400">{item.unit}</span></td>
                              {me?.role==="ADMIN" && <td className="px-3 py-2.5 font-mono text-xs text-emerald-700">{item.weightKg ? `${item.weightKg} kg` : "—"}</td>}
                              <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.status === "RECEIVED" ? "bg-green-100 text-green-700" : item.status === "ORDERED" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{item.status}</span></td>
                              <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</td>
                            </tr>
                            {/* Expandable log */}
                            {procExpanded === item.id && item.logs?.length > 0 && (
                              <tr className="bg-slate-50">
                                <td colSpan={8} className="px-4 py-2">
                                  <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">Activity Log</p>
                                  <div className="space-y-1">
                                    {[...item.logs].reverse().map((log: any) => (
                                      <div key={log.id} className="flex flex-wrap items-center gap-2 text-xs">
                                        <span className="font-mono text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                                        <span className={`rounded-full px-2 py-0.5 font-bold ${log.action === "RECEIVED" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{log.action}</span>
                                        {log.newValue && <span className="rounded bg-green-50 px-1 font-mono text-green-700">{log.newValue}</span>}
                                        <span className="ml-auto text-slate-400">by {log.updatedBy}</span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-right text-xs text-slate-400">Read-only view — <a href="/procurement" className="text-blue-500 underline">Manage in Procurement module →</a></p>
              </div>
            ) : (

              /* ── Non-procurement: existing detail table ── */
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                {selectedStage && !(
                  selectedStage.status === "NOT_STARTED" &&
                  Number(selectedStage.progress ?? 0) === 0 &&
                  !selectedStage.delayReason && !selectedStage.plannedDate && !selectedStage.actualDate
                ) ? (
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-2">Item</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-3 font-medium text-slate-800">Progress</td>
                        <td className="px-3 py-3 font-mono font-bold text-blue-600">{selectedStage?.progress ?? 0}%</td>
                        <td className="px-3 py-3 text-xs text-slate-600">{fmtDateTime(selectedStage?.updatedAt)}</td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-3 font-medium text-slate-800">Status</td>
                        <td className="px-3 py-3"><StatusBadge value={selectedStage?.status ?? "NOT_STARTED"} /></td>
                        <td className="px-3 py-3 text-xs text-slate-600">{fmtDateTime(selectedStage?.updatedAt)}</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-3 py-3 font-medium text-slate-800">Delay Reason</td>
                        <td className="px-3 py-3">{selectedStage?.delayReason || "None"}</td>
                        <td className="px-3 py-3 text-xs text-slate-600">{fmtDateTime(selectedStage?.updatedAt)}</td>
                      </tr>
                      {selectedStage?.stageDetails && typeof selectedStage.stageDetails === "object" &&
                        Object.entries(selectedStage.stageDetails as Record<string, unknown>)
                          .filter(([k]) => k !== "procurementLog")
                          .map(([key, val]) => (
                            <tr key={key} className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="px-3 py-3 font-medium capitalize text-slate-600">{key.replace(/([A-Z])/g," $1").trim()}</td>
                              <td className="px-3 py-3 font-medium text-slate-800">{val === true ? "✓ Yes" : val === false ? "✗ No" : String(val ?? "—")}</td>
                              <td className="px-3 py-3 text-xs text-slate-400">—</td>
                            </tr>
                          ))
                      }
                    </tbody>
                  </table>
                ) : (
                  <div className="erp-empty py-10">
                    <ClipboardList className="erp-empty-icon h-12 w-12" />
                    <p className="erp-empty-title">No items in this stage</p>
                    <p className="erp-empty-sub">Once progress is updated, details will appear here.</p>
                  </div>
                )}
              </div>
            )}
          </article>

          {/* ── Progress History ─────────────────────────────────────────── */}
          <article className="industrial-card rounded-xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
                <History className="h-5 w-5 text-cyan-700" />
                Progress History — {selectedStage?.stage?.name ?? ""}
              </h3>
              <button type="button" onClick={() => setLogExpanded(v => !v)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50">
                {logExpanded ? "Collapse" : "Expand"} ({stageLogs.length})
              </button>
            </div>

            {logExpanded && (
              stageLogs.length === 0 ? (
                <div className="erp-empty py-8">
                  <History className="erp-empty-icon h-10 w-10" />
                  <p className="erp-empty-title text-sm">No history yet</p>
                  <p className="erp-empty-sub">Changes will appear here after the first update.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {stageLogs.map((log: any, i: number) => (
                    <div
                      key={log.id}
                      className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-xs ${i % 2 === 0 ? "bg-white" : "bg-slate-50/70"} ${i !== stageLogs.length - 1 ? "border-b border-slate-100" : ""}`}
                    >
                      <span className="shrink-0 font-mono text-slate-400">{fmtDateTime(log.createdAt)}</span>
                      <span className="flex flex-wrap items-center gap-1 font-medium text-slate-700">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.68rem] font-bold text-slate-600">{log.field}</span>
                        <span className="text-slate-400">updated</span>
                        <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-[0.68rem] font-semibold text-red-600 line-through">{log.previousValue ?? "—"}</span>
                        <span className="text-slate-400">→</span>
                        <span className="rounded bg-green-50 px-1.5 py-0.5 font-mono text-[0.68rem] font-semibold text-green-700">{log.newValue ?? "—"}</span>
                      </span>
                      <span className="ml-auto shrink-0 text-slate-400">by <span className="font-semibold text-slate-600">{log.updatedBy}</span></span>
                    </div>
                  ))}
                </div>
              )
            )}
          </article>
        </div>

        {/* ── Right column — Control Panel ─────────────────────────────────── */}
        <aside className="space-y-5 xl:col-span-3">
          {me?.role === "ADMIN" ? (
            <article className="industrial-card rounded-xl border-2 border-slate-300 p-5">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
                <Hammer className="h-5 w-5 text-cyan-700" />
                Control Panel
              </h3>

              <div className="space-y-4">
                {/* — Drawing date — */}
                <div>
                  <label className="industrial-label">Drawing received date</label>
                  <input
                    type="date"
                    value={drawingInput}
                    onChange={(e) => setDrawingInput(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                {/* — Production duration — */}
                <div>
                  <label className="industrial-label">Production duration (days)</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min={7}
                      max={365}
                      value={durationInput}
                      onChange={(e) => setDurationInput(Math.max(7, Math.min(365, Number(e.target.value))))}
                      className="w-24 rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <span className="text-xs text-slate-500">days (default: 28)</span>
                  </div>
                  <div className="mt-1.5 flex gap-2">
                    {[28, 42, 56].map(d => (
                      <button key={d} type="button" onClick={() => setDurationInput(d)}
                        className={`rounded-md border px-2.5 py-1 text-xs font-bold transition-colors ${durationInput === d ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>

                {/* — Exclude Sundays toggle — */}
                <div>
                  <label className="industrial-label">Include Sundays in production?</label>
                  <div className="mt-1.5 flex gap-2">
                    {[
                      { label: "Yes", value: false },
                      { label: "No (factory closed)", value: true }
                    ].map(({ label, value }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setExcludeSundaysInput(value)}
                        className={`flex-1 rounded-lg border py-2 text-xs font-bold transition-colors ${excludeSundaysInput === value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {excludeSundaysInput ? "Sundays skipped — timeline spans more calendar days." : "All calendar days counted."}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={Boolean(updatingId)}
                  onClick={async () => {
                    // ── Step 1: Frontend validation ─────────────────────────
                    if (!drawingInput) {
                      setToast({ kind: "error", message: "Please set the Drawing Received Date before saving." });
                      return;
                    }
                    if (!durationInput || durationInput < 7 || durationInput > 365) {
                      setToast({ kind: "error", message: "Production duration must be between 7 and 365 days." });
                      return;
                    }

                    try {
                      setUpdatingId("timeline");
                      // ── Step 2: Build exact API payload ─────────────────
                      const iso = new Date(drawingInput).toISOString();
                      const res = await fetch("/api/project", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          id:                    project.id,
                          updatedAt:             project.updatedAt,
                          drawingReceivedDate:   iso,
                          productionDurationDays: durationInput,
                          excludeSundays:        excludeSundaysInput
                        })
                      });
                      const payload = await res.json();

                      if (payload.success) {
                        // ── Step 3: Immediately update state from response ─
                        // updateProjectTimeline returns the full enriched project,
                        // so we set it directly — Timeline + Gantt update instantly.
                        setProject(payload.data);
                        setToast({ kind: "success", message: "✓ Timeline settings saved" });
                      } else {
                        setToast({ kind: "error", message: payload.message });
                      }

                      setUpdatingId(null);
                      await load(id); // sync logs + any fields not in PATCH response
                    } catch (e) {
                      setUpdatingId(null);
                      setToast({ kind: "error", message: "Failed to save timeline. Check server connection." });
                    }
                  }}
                  className="w-full btn-secondary justify-center"
                >
                  {updatingId === "timeline" ? "Saving…" : "Save Timeline Settings"}
                </button>

                <hr className="border-slate-200" />

                {/* — Stage selector — */}
                <div>
                  <label className="industrial-label">Stage</label>
                  <select
                    value={selectedStageId}
                    onChange={(e) => { const st = project.stages.find((s: any) => s.id === e.target.value); if (st) selectStage(st); }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  >
                    {project.stages.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.stage.name}</option>
                    ))}
                  </select>
                </div>

                {/* — Progress slider — */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="industrial-label">Progress</label>
                    <span className="font-mono text-xs font-bold text-blue-600">{quickUpdate.progress}%</span>
                  </div>
                  <input
                    type="range" min={0} max={100} value={quickUpdate.progress}
                    onChange={(e) => {
                      const p = Number(e.target.value);
                      // Auto-derive status from progress — user can still manually override
                      setQuickUpdate(prev => ({ ...prev, progress: p, status: deriveStatus(p) }));
                    }}
                    className="w-full accent-blue-600"
                  />
                  <div className="mt-1 flex justify-between text-[0.62rem] text-slate-400">
                    <span>0% → Not Started</span>
                    <span>1–99% → In Progress</span>
                    <span>100% → Completed</span>
                  </div>
                </div>

                {/* — Status — */}
                <div>
                  <label className="industrial-label">Status</label>
                  <select value={quickUpdate.status} onChange={(e) => setQuickUpdate(p => ({ ...p, status: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                    <option value="NOT_STARTED">NOT_STARTED</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>

                {/* — Delay reason — */}
                <div>
                  <label className="industrial-label">Delay Reason</label>
                  <select value={quickUpdate.delayReason} onChange={(e) => setQuickUpdate(p => ({ ...p, delayReason: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                    <option value="">No delay reason</option>
                    {DELAY_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                {/* ── Stage-specific detail forms ──────────────────────── */}
                {detailType && detailType !== "procurement" && (
                  <>
                    <hr className="border-slate-200" />
                    <div>
                      <p className="industrial-label mb-3">
                        {detailType === "drawing" ? "Drawing Details"
                          : detailType === "machining" ? "Machining Details"
                          : "Cutting & Bending Details"}
                      </p>

                      {detailType === "drawing" && (
                        <div className="space-y-2">
                          {[
                            { key: "designApproval", label: "Design Approval" },
                            { key: "sorting",        label: "Sorting"         },
                            { key: "nesting",        label: "Nesting"         }
                          ].map(({ key, label }) => (
                            <label key={key} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:bg-slate-50">
                              <input type="checkbox" checked={Boolean(stageDetails[key])}
                                onChange={(e) => setStageDetails(p => ({ ...p, [key]: e.target.checked }))}
                                className="h-4 w-4 accent-blue-600" />
                              <span className="text-sm font-medium text-slate-800">{label}</span>
                              {Boolean(stageDetails[key]) && <span className="ml-auto text-xs font-bold text-green-600">✓ Done</span>}
                            </label>
                          ))}
                        </div>
                      )}

                      {detailType === "machining" && (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-slate-600">Raw Material Used</label>
                            <input type="text" value={(stageDetails.rawMaterial as string) || ""} placeholder="e.g. EN8 Rod, MS Flat Bar"
                              onChange={(e) => setStageDetails(p => ({ ...p, rawMaterial: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600">Machining Process</label>
                            <input type="text" value={(stageDetails.machiningProcess as string) || ""} placeholder="e.g. Turning, Drilling, Milling"
                              onChange={(e) => setStageDetails(p => ({ ...p, machiningProcess: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600">Quantity Processed</label>
                            <input type="number" min={0} value={(stageDetails.machinedQty as string) || ""}
                              onChange={(e) => setStageDetails(p => ({ ...p, machinedQty: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600">Notes</label>
                            <textarea rows={2} value={(stageDetails.machiningNotes as string) || ""} placeholder="Tolerances, surface finish requirements, etc."
                              onChange={(e) => setStageDetails(p => ({ ...p, machiningNotes: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                          </div>
                        </div>
                      )}

                      {detailType === "cutting" && (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-slate-600">Material Name</label>
                            <input type="text" value={(stageDetails.material as string) || ""} placeholder="e.g. Mild Steel Plate"
                              onChange={(e) => setStageDetails(p => ({ ...p, material: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600">Thickness</label>
                            <select value={(stageDetails.thickness as string) || ""}
                              onChange={(e) => setStageDetails(p => ({ ...p, thickness: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                              <option value="">Select Thickness</option>
                              {THICKNESS_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600">Quantity</label>
                            <input type="number" min={0} value={(stageDetails.quantity as string) || ""}
                              onChange={(e) => setStageDetails(p => ({ ...p, quantity: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ── Procurement: Add material entry form ─────────────── */}
                {detailType === "procurement" && (
                  <>
                    <hr className="border-slate-200" />
                    <div>
                      <button
                        type="button"
                        onClick={() => setProcFormOpen(v => !v)}
                        className="flex w-full items-center justify-between rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Add Material Entry</span>
                        {procFormOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>

                      {procFormOpen && (
                        <div className="mt-3 space-y-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                          {/* Material type */}
                          <div>
                            <label className="text-xs font-semibold text-slate-600">Material Type</label>
                            <div className="mt-1.5 flex gap-2">
                              {(["MS","SS"] as const).map(type => (
                                <button key={type} type="button"
                                  onClick={() => setProcForm(p => ({ ...p, materialType: type }))}
                                  className={`flex-1 rounded-lg border py-2 text-sm font-bold transition-colors ${procForm.materialType === type ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Thickness */}
                          <div>
                            <label className="text-xs font-semibold text-slate-600">Thickness <span className="text-red-500">*</span></label>
                            <select value={procForm.thickness}
                              onChange={(e) => setProcForm(p => ({ ...p, thickness: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                              <option value="">Select Thickness</option>
                              {THICKNESS_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>

                          {/* Quantity */}
                          <div>
                            <label className="text-xs font-semibold text-slate-600">Quantity <span className="text-red-500">*</span></label>
                            <input type="number" min={1} value={procForm.quantity} placeholder="e.g. 10"
                              onChange={(e) => setProcForm(p => ({ ...p, quantity: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                          </div>

                          {/* Sheet size */}
                          <div>
                            <label className="text-xs font-semibold text-slate-600">Sheet Size</label>
                            <select value={procForm.sheetSize}
                              onChange={(e) => setProcForm(p => ({ ...p, sheetSize: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                              <option value="">Select Sheet Size (optional)</option>
                              {SHEET_SIZE_OPTIONS.map(sz => <option key={sz} value={sz}>{sz} mm</option>)}
                            </select>
                          </div>

                          {/* Action type */}
                          <div>
                            <label className="text-xs font-semibold text-slate-600">Action Type</label>
                            <div className="mt-1.5 flex gap-2">
                              {(["ORDERED","RECEIVED"] as const).map(action => (
                                <button key={action} type="button"
                                  onClick={() => setProcForm(p => ({ ...p, actionType: action }))}
                                  className={`flex-1 rounded-lg border py-2 text-xs font-bold transition-colors ${procForm.actionType === action ? (action === "ORDERED" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-green-500 bg-green-50 text-green-700") : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                                  {action}
                                </button>
                              ))}
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={addingProc}
                            onClick={handleAddProcurement}
                            className="w-full btn-primary justify-center py-2.5"
                          >
                            <Plus className="h-4 w-4" />
                            {addingProc ? "Adding…" : "Add Entry"}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* — Save stage update — */}
                <button
                  disabled={Boolean(updatingId) || !selectedStage}
                  onClick={async () => {
                    if (!selectedStage) return;

                    // ── 1. Capture stale timestamps BEFORE any optimistic mutation ──
                    const staleId        = selectedStage.id;
                    const staleUpdatedAt = selectedStage.updatedAt;
                    const autoActualDate =
                      quickUpdate.progress >= 100
                        ? (selectedStage.actualDate ?? new Date().toISOString())
                        : undefined;

                    // ── 2. Optimistic update → Timeline & Gantt refresh instantly ──
                    setProject((prev: any) =>
                      !prev ? prev : {
                        ...prev,
                        stages: prev.stages.map((s: any) =>
                          s.id !== staleId ? s : {
                            ...s,
                            progress:    quickUpdate.progress,
                            status:      quickUpdate.status,
                            delayReason: quickUpdate.delayReason || null,
                            isDelayed:   !!quickUpdate.delayReason,
                            actualDate:  autoActualDate ?? s.actualDate,
                            updatedAt:   new Date().toISOString()
                          }
                        )
                      }
                    );

                    try {
                      setUpdatingId(staleId);
                      const res = await fetch("/api/project-stage", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          id:          staleId,
                          updatedAt:   staleUpdatedAt,   // original server timestamp
                          progress:    quickUpdate.progress,
                          status:      quickUpdate.status,
                          delayReason: quickUpdate.delayReason || null,
                          // Lock actualDate on completion
                          ...(autoActualDate ? { actualDate: autoActualDate } : {}),
                          stageDetails:
                            detailType && detailType !== "procurement" &&
                            Object.keys(stageDetails).length > 0
                              ? stageDetails : null
                        })
                      });
                      const payload = await res.json();

                      if (payload.success) {
                        setSaveGlow(true);
                        setTimeout(() => setSaveGlow(false), 2000);
                        // Flash the stage card green for 2.5 s
                        setChangedStageId(staleId);
                        setTimeout(() => setChangedStageId(null), 2500);
                        setToast({ kind: "success", message: "✓ Timeline updated successfully" });
                        await load(id); // sync authoritative state from server
                      } else {
                        setToast({ kind: "error", message: payload.message });
                        await load(id); // revert optimistic update
                      }
                    } catch (e) {
                      setToast({ kind: "error", message: "Failed to save stage" });
                      await load(id); // revert on network error
                    } finally {
                      setUpdatingId(null);
                    }
                  }}
                  className={`w-full justify-center py-3 btn-primary ${saveGlow ? "bg-green-600 hover:bg-green-700 shadow-[0_0_15px_rgba(22,163,74,0.5)]" : ""}`}
                >
                  <Save className="h-4 w-4" />
                  {updatingId && updatingId !== "timeline" ? "Saving…" : "Save Stage Update"}
                </button>
              </div>
            </article>
          ) : (
            <article className="industrial-card rounded-xl border border-slate-200 p-5">
              <h3 className="text-lg font-black text-slate-900">Control Panel</h3>
              <p className="mt-2 text-sm text-slate-600">View-only access. Contact admin for updates.</p>
            </article>
          )}

          {/* Summary card */}
          <article className="industrial-card rounded-xl p-5">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-900">
              <Gauge className="h-5 w-5 text-cyan-700" />Summary
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Total completion</span><span className="font-bold text-cyan-700">{project.metrics.totalProgress.toFixed(1)}%</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Current stage</span><span className="font-bold text-slate-900">{project.metrics.currentStage}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Days remaining</span><span className={`font-bold ${overdueTimeline ? "text-red-600" : "text-slate-900"}`}>{dr === null ? "—" : `${dr} d`}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Duration</span><span className="font-bold text-slate-900">{totalDays} days</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Sundays</span><span className={`font-bold ${excSundays ? "text-amber-600" : "text-slate-700"}`}>{excSundays ? "Excluded" : "Included"}</span></div>
            </div>
          </article>
        </aside>
      </section>

      {/* ── Stage Delays (read-only) ─────────────────────────────────────── */}
      {delayedStages.length > 0 && (
        <section className="industrial-card rounded-xl p-4">
          <h2 className="mb-3 flex items-center gap-2 text-base font-black text-slate-900">
            <AlertTriangle className="h-4 w-4 text-red-500" /> Stage Delays
          </h2>
          <div className="grid gap-2 md:grid-cols-2">
            {delayedStages.map((s: any) => (
              <div key={s.id} className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                <p className="font-semibold">{s.stage.name}</p>
                <p className="text-sm">{s.delayReason ?? "Delayed"}</p>
              </div>
            ))}
          </div>
        </section>
      )}


      {/* ── Electrical Panel Tracking ─────────────────────────────────────── */}
      <section className="industrial-card rounded-xl p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <Wrench className="h-5 w-5 text-amber-600" /> Electrical Panel Tracking
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
              {panels.filter((p:any) => p.status === "COMPLETED").length}/{panels.length} done
            </span>
          </h2>
          {me?.role === "ADMIN" && (
            <button onClick={() => setPanelFormOpen(v => !v)} className="btn-secondary gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> {panelFormOpen ? "Cancel" : "Add Panel"}
            </button>
          )}
        </div>

        {/* Add form */}
        {panelFormOpen && me?.role === "ADMIN" && (
          <div className="mb-5 grid gap-3 rounded-xl border border-amber-100 bg-amber-50/40 p-4 md:grid-cols-4">
            <div>
              <label className="industrial-label">Panel Name / ID *</label>
              <input value={panelForm.panelName} onChange={e => setPanelForm(f => ({ ...f, panelName: e.target.value }))} placeholder="e.g. MCC Panel 1"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="industrial-label">Assigned To</label>
              <input value={panelForm.assignedTo} onChange={e => setPanelForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="Technician name"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="industrial-label">Remarks</label>
              <input value={panelForm.remarks} onChange={e => setPanelForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Optional notes"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div className="flex items-end">
              <button type="button" disabled={addingPanel || !panelForm.panelName.trim()} onClick={async () => {
                setAddingPanel(true);
                const r = await fetch("/api/electrical-panels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: project.id, ...panelForm }) });
                const p = await r.json();
                if (p.success) { setPanelForm({ panelName: "", assignedTo: "", remarks: "" }); setPanelFormOpen(false); loadPanels(project.id); setToast({ kind: "success", message: "Panel added" }); }
                else setToast({ kind: "error", message: p.message });
                setAddingPanel(false);
              }} className="btn-primary w-full">{addingPanel ? "Adding…" : "Add Panel"}</button>
            </div>
          </div>
        )}

        {/* Panel cards */}
        {panels.length === 0 ? (
          <div className="erp-empty py-8">
            <Wrench className="erp-empty-icon h-10 w-10" />
            <p className="erp-empty-title text-sm">No panels tracked yet</p>
            {me?.role === "ADMIN" && <p className="erp-empty-sub">Click "Add Panel" to start tracking electrical panels.</p>}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {panels.map((panel: any) => {
              const pct = panel.status === "COMPLETED" ? 100 : panel.status === "IN_PROGRESS" ? 50 : 0;
              const colours = panel.status === "COMPLETED"
                ? { border: "border-green-300", bg: "bg-green-50", badge: "bg-green-100 text-green-700", bar: "bg-green-500" }
                : panel.status === "IN_PROGRESS"
                ? { border: "border-blue-300", bg: "bg-blue-50", badge: "bg-blue-100 text-blue-700", bar: "bg-blue-500" }
                : { border: "border-slate-200", bg: "bg-white", badge: "bg-slate-100 text-slate-600", bar: "bg-slate-300" };
              return (
                <div key={panel.id} className={`rounded-xl border-2 ${colours.border} ${colours.bg} p-4 flex flex-col gap-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-slate-800 leading-tight">{panel.panelName}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${colours.badge}`}>
                      {panel.status.replace("_", " ")}
                    </span>
                  </div>
                  {panel.assignedTo && (
                    <p className="text-xs text-slate-500">👤 {panel.assignedTo}</p>
                  )}
                  {panel.remarks && (
                    <p className="text-xs italic text-slate-400">{panel.remarks}</p>
                  )}
                  {/* Progress bar */}
                  <div>
                    <div className="mb-1 flex justify-between text-[0.65rem] font-bold text-slate-500">
                      <span>Progress</span><span>{pct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200">
                      <div className={`h-2 rounded-full transition-all duration-500 ${colours.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {/* Status control (admin only) */}
                  {me?.role === "ADMIN" && (
                    <select value={panel.status} onChange={async e => {
                      const r = await fetch("/api/electrical-panels", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: panel.id, status: e.target.value }) });
                      const p = await r.json();
                      if (p.success) loadPanels(project.id);
                      else setToast({ kind: "error", message: p.message });
                    }} className="mt-auto w-full rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-bold outline-none focus:border-amber-400 cursor-pointer">
                      <option value="NOT_STARTED">Not Started</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Client Remarks ──────────────────────────────────────────────────── */}

      <section className="industrial-card rounded-xl p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
          <MessageSquare className="h-5 w-5 text-blue-600" /> Client Remarks
        </h2>

        {/* Input form */}
        <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="industrial-label">Section (optional)</label>
              <select
                value={remarkStageId}
                onChange={e => setRemarkStageId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">— General / No specific stage —</option>
                {project.stages?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.stage.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="industrial-label">Your Remark</label>
            <textarea
              rows={3}
              value={remarkText}
              onChange={e => setRemarkText(e.target.value)}
              placeholder="Describe the issue, concern, or update for this project…"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={submittingRemark || !remarkText.trim()}
              onClick={submitRemark}
              className="btn-primary gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              {submittingRemark ? "Submitting…" : "Submit Remark"}
            </button>
          </div>
        </div>

        {/* Remarks list */}
        <div className="mt-4 space-y-3">
          {remarks.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-4">No remarks yet. Be the first to add one.</p>
          ) : remarks.map((r: any) => (
            <div key={r.id} className={`rounded-lg border p-4 ${r.role === "ADMIN" ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${r.role === "ADMIN" ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                  {r.role}
                </span>
                {r.stageName && (
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[0.65rem] font-bold text-amber-700">
                    {r.stageName}
                  </span>
                )}
                <span className="text-xs text-slate-500">{r.createdBy}</span>
                <span className="ml-auto font-mono text-[0.65rem] text-slate-400">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{r.message}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Dispatch modal ─────────────────────────────────────────────────── */}
      {confirmDispatch && me?.role === "ADMIN" && (
        <div className="erp-modal-overlay">
          <div className="erp-modal">
            <p className="industrial-label text-violet-700">Final Action</p>
            <h3 className="mt-1 text-xl font-black text-slate-900">Dispatch this project?</h3>
            <p className="mt-2 text-sm text-slate-600">Are you sure you want to dispatch <strong>{project.projectNo}</strong>? This is a <strong>final state</strong>.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setConfirmDispatch(false)}>Cancel</button>
              <button type="button" disabled={dispatching} className="btn-dispatch"
                onClick={async () => {
                  try {
                    setDispatching(true);
                    const r = await fetch(`/api/projects/${project.id}/dispatch`, { method: "PATCH" });
                    const payload = await r.json();
                    if (!r.ok || !payload.success) { setToast({ kind: "error", message: payload.message || "Failed" }); setDispatching(false); return; }
                    setToast({ kind: "success", message: "Dispatched successfully" });
                    window.location.href = "/dispatched";
                  } catch (e) { setDispatching(false); setToast({ kind: "error", message: "Failed to dispatch" }); }
                }}>
                <Truck className="h-4 w-4" /> {dispatching ? "Dispatching…" : "Yes, Dispatch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete modal ───────────────────────────────────────────────────── */}
      {confirmDelete && me?.role === "ADMIN" && (
        <div className="erp-modal-overlay">
          <div className="erp-modal">
            <p className="industrial-label text-red-600">Admin action</p>
            <h3 className="mt-1 text-xl font-black text-slate-900">Move project to Trash?</h3>
            <p className="mt-2 text-sm text-slate-600">This project will be hidden from dashboards and can be restored later from Admin Trash.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button type="button" disabled={deleting} className="btn-danger"
                onClick={async () => {
                  try {
                    setDeleting(true);
                    const r = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
                    const payload = await r.json();
                    if (!r.ok || !payload.success) { setToast({ kind: "error", message: payload.message || "Failed" }); setDeleting(false); return; }
                    window.location.href = "/dashboard";
                  } catch (e) { setDeleting(false); setToast({ kind: "error", message: "Failed to delete" }); }
                }}>
                <Trash className="h-4 w-4" /> {deleting ? "Deleting…" : "Move to Trash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
