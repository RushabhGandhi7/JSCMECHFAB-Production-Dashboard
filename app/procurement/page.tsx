"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Package, Plus, ChevronDown, ChevronUp, Clock, CheckCircle2, AlertTriangle, Scale, DollarSign, X, Trash2, AlertCircle } from "lucide-react";
import { Toast } from "@/components/Toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";

type ProcItem = {
  id: string; projectId: string; category: string; materialName: string;
  materialType: string; thickness: number | null; lengthMm: number | null;
  widthMm: number | null; quantity: number; receivedQty: number; unit: string;
  weightKg: number | null; manualWeightKg: number | null; isLumpsum: boolean;
  ratePerKg: number | null; totalValue: number | null;
  vendor: string | null; notes: string | null; status: string;
  isDeleted: boolean; deletedAt: string | null;
  createdAt: string;
  logs: { id: string; action: string; previousValue: string | null; newValue: string | null; updatedBy: string; createdAt: string; }[];
};

type Project = { id: string; projectNo: string; clientName: string; client?: { name: string } | null; };

const CATEGORIES = [
  { key: "SHEET_METAL", label: "Sheet Metal", color: "blue" },
  { key: "HARDWARE", label: "Hardware", color: "purple" },
  { key: "ANGLE_PIPE", label: "Angle / Pipe", color: "orange" },
  { key: "MACHINING_RAW", label: "Machining Raw", color: "cyan" },
  { key: "ELECTRICAL", label: "Electrical", color: "yellow" },
  { key: "MISCELLANEOUS", label: "Miscellaneous", color: "slate" },
] as const;

const CAT_COLORS: Record<string, string> = {
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  cyan: "bg-cyan-100 text-cyan-700 border-cyan-200",
  yellow: "bg-yellow-100 text-yellow-700 border-yellow-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  ORDERED: "bg-blue-100 text-blue-700",
  RECEIVED: "bg-green-100 text-green-700",
};

const DENSITY: Record<string, number> = { MS: 7.85, SS: 8.0, Others: 7.85 };

function calcWeight(l: number, w: number, t: number, qty: number, type: string) {
  const d = DENSITY[type] ?? 7.85;
  return parseFloat(((l * w * t * d * qty) / 1_000_000).toFixed(3));
}

function fmt(n: number | null | undefined, dec = 2) {
  if (n == null) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: dec });
}

const SHEET_SIZES = ["1250x2500", "1500x3000", "Custom"] as const;
const THICKNESS_OPTIONS = ["2", "3", "4", "5", "6", "8", "10", "12", "14", "16", "18", "20"] as const;
const HARDWARE_TYPES = ["Nut", "Bolt", "Washer", "Screw", "Anchor", "Stud", "Other"] as const;
const ANGLE_PIPE_TYPES = ["Angle", "Pipe", "Channel", "Beam", "Rod", "Flat"] as const;

const defaultForm = () => ({
  projectId: "", category: "SHEET_METAL", materialName: "", materialType: "MS",
  // Pre-populate from the default sheet size so the calculator works immediately
  thickness: "", lengthMm: "1250", widthMm: "2500", quantity: "", unit: "sheet",
  ratePerKg: "", vendor: "", notes: "",
  manualWeightKg: "",
  // Hardware extras
  hardwareType: "Nut", isLumpSum: false,
  // Angle/Pipe extras
  anglePipeType: "Angle", dimensions: "",
  // Sheet size — default is 1250x2500
  sheetSize: "1250x2500", customSheetSize: "",
});

export default function ProcurementPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selProject, setSelProject] = useState("");
  const [items, setItems] = useState<ProcItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const [saving, setSaving] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("ALL");
  const [me, setMe] = useState<{ role: string } | null>(null);
  const isAdmin = me?.role === "ADMIN";
  // ── Soft-delete state ──────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget]     = useState<ProcItem | null>(null);
  const [deleting, setDeleting]             = useState(false);
  // ── Deleted items section ───────────────────────────────────────────
  const [deletedItems, setDeletedItems]     = useState<ProcItem[]>([]);
  const [permTarget, setPermTarget]         = useState<ProcItem | null>(null);
  const [permDeleting, setPermDeleting]     = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then(r => r.json())
      .then(p => { if (p.success) setProjects(p.data); });
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(p => { if (p.success) setMe(p.data); });
  }, []);

  async function loadItems(pid: string) {
    if (!pid) return;
    setLoading(true);
    // Active items only — server filters NOT {isDeleted: true}
    const r = await fetch(`/api/procurement?projectId=${pid}`);
    const p = await r.json();
    if (p.success) setItems(p.data);
    setLoading(false);
  }

  async function loadDeletedItems(pid: string) {
    if (!pid) return;
    // Fetch only soft-deleted items for the Deleted Materials section
    const r = await fetch(`/api/procurement?projectId=${pid}&includeDeleted=true`);
    const p = await r.json();
    if (p.success) setDeletedItems((p.data as ProcItem[]).filter(i => i.isDeleted));
  }


  // Active (non-deleted) items — drives all totals and KPIs
  const activeItems  = items.filter(i => !i.isDeleted);
  const displayItems = activeTab === "ALL" ? activeItems : activeItems.filter(i => i.category === activeTab);

  // Totals are ALWAYS based on active (non-deleted) items only
  const totals = useMemo(() => ({
    ordered:  activeItems.reduce((s, i) => s + (i.weightKg ?? 0), 0),
    received: activeItems.filter(i => i.status === "RECEIVED").reduce((s, i) => s + (i.weightKg ?? 0), 0),
    value:    activeItems.reduce((s, i) => s + (i.totalValue ?? 0), 0),
  }), [activeItems]);

  // Weight calculator (server-side formula for display only)
  const calcedWeight = useMemo(() => {
    if (!isAdmin) return null;
    const l = parseFloat(form.lengthMm), w = parseFloat(form.widthMm);
    const t = parseFloat(form.thickness), q = parseFloat(form.quantity);
    if (!l || !w || !t || !q) return null;
    return calcWeight(l, w, t, q, form.materialType);
  }, [form.lengthMm, form.widthMm, form.thickness, form.quantity, form.materialType, isAdmin]);

  const calcedValue = useMemo(() => {
    if (!calcedWeight || !form.ratePerKg) return null;
    return parseFloat((calcedWeight * parseFloat(form.ratePerKg)).toFixed(2));
  }, [calcedWeight, form.ratePerKg]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selProject) { setToast({ kind: "error", message: "Select a project first" }); return; }

    // ── Front-end validation ─────────────────────────────────────────────────
    if (!form.materialName.trim()) {
      setToast({ kind: "error", message: "Material name is required" }); return;
    }
    const qty = parseFloat(form.quantity);
    if (!qty || qty <= 0) {
      setToast({ kind: "error", message: "Quantity must be greater than 0" }); return;
    }
    if (form.category === "SHEET_METAL") {
      if (!form.thickness) {
        setToast({ kind: "error", message: "Select a thickness for Sheet Metal" }); return;
      }
      if (!form.lengthMm || !form.widthMm) {
        setToast({ kind: "error", message: "Select a sheet size" }); return;
      }
      if (calcedWeight === null) {
        setToast({ kind: "error", message: "Weight could not be calculated — check dimensions & quantity" }); return;
      }
    }

    setSaving(true);

    // Build payload — send calculated weight explicitly so the server never needs to re-derive it
    const payload: Record<string, unknown> = {
      projectId: selProject,
      category: form.category,
      materialName: form.materialName.trim(),
      materialType: form.materialType,
      quantity: qty,
      unit: form.unit,
      vendor: form.vendor || undefined,
      notes: form.notes || undefined,
      ratePerKg: form.ratePerKg ? parseFloat(form.ratePerKg) : undefined,
      isLumpsum: form.isLumpSum,
    };

    if (form.category === "SHEET_METAL") {
      payload.thickness = parseFloat(form.thickness);         // number, never string
      payload.lengthMm = parseFloat(form.lengthMm);         // number
      payload.widthMm = parseFloat(form.widthMm);          // number
      // Send the pre-calculated weight so the server stores exactly what the user saw
      payload.manualWeightKg = calcedWeight;                  // used as effectiveWeight on server
    } else {
      payload.manualWeightKg = form.manualWeightKg ? parseFloat(form.manualWeightKg) : undefined;
    }

    const r = await fetch("/api/procurement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const p = await r.json();
    if (p.success) {
      setToast({ kind: "success", message: `Item added — ${calcedWeight ?? form.manualWeightKg ?? ""} ${calcedWeight || form.manualWeightKg ? "kg" : ""}`.trim() });
      setForm(defaultForm());
      setShowForm(false);
      loadItems(selProject);
    } else {
      setToast({ kind: "error", message: p.message ?? "Failed to save item" });
    }
    setSaving(false);
  }

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    const r = await fetch("/api/procurement", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    const p = await r.json();
    if (p.success) { loadItems(selProject); setToast({ kind: "success", message: `Marked as ${status}` }); }
    else setToast({ kind: "error", message: p.message });
    setUpdatingId(null);
  }

  // Soft-delete: sets isDeleted=true, item moves to Deleted Materials section
  async function deleteItem(item: ProcItem) {
    setDeleting(true);
    try {
      const r = await fetch("/api/procurement", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const p = await r.json();
      if (p.success) {
        setDeleteTarget(null);
        setToast({ kind: "success", message: `"${item.materialName}" moved to Deleted Materials` });
        // Refresh both lists
        await loadItems(selProject);
        await loadDeletedItems(selProject);
      } else {
        setToast({ kind: "error", message: p.message ?? "Delete failed" });
      }
    } catch {
      setToast({ kind: "error", message: "Network error — please try again" });
    }
    setDeleting(false);
  }

  // Hard-delete: permanently removes from DB (only for already-soft-deleted items)
  async function permanentDeleteItem(item: ProcItem) {
    setPermDeleting(true);
    try {
      const r = await fetch("/api/procurement/permanent", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const p = await r.json();
      if (p.success) {
        setPermTarget(null);
        setToast({ kind: "success", message: `"${item.materialName}" permanently deleted` });
        await loadDeletedItems(selProject);
      } else {
        setToast({ kind: "error", message: p.message ?? "Permanent delete failed" });
      }
    } catch {
      setToast({ kind: "error", message: "Network error — please try again" });
    }
    setPermDeleting(false);
  }

  return (
    <main className="mx-auto max-w-[1700px] space-y-5 bg-[#f8fafc] p-4 md:p-6">
      {toast && <Toast message={toast.message} kind={toast.kind} />}

      {/* Header */}
      <header className="industrial-card rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="industrial-label">Material Management</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
              <Package className="h-7 w-7 text-emerald-600" /> Procurement
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selProject}
              onChange={e => {
                const pid = e.target.value;
                setSelProject(pid);
                loadItems(pid);
                if (isAdmin) loadDeletedItems(pid);
                setForm(f => ({ ...f, projectId: pid }));
              }}
              className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">— Select Project —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.projectNo} — {p.client?.name ?? p.clientName}</option>)}
            </select>
            {selProject && isAdmin && (
              <button onClick={() => setShowForm(v => !v)} className="btn-primary gap-2">
                <Plus className="h-4 w-4" /> Add Item
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Totals KPI — weight fields admin-only, always from active items */}
      {selProject && !loading && activeItems.length > 0 && (
        <section className={`grid gap-4 ${isAdmin ? "sm:grid-cols-4" : "sm:grid-cols-1 max-w-xs"}`}>
          {[
            { label: "Total Items",         value: activeItems.length.toString(),  icon: Package,      color: "text-blue-600",   bg: "bg-blue-50",   show: true },
            { label: "Total Ordered Wt.",   value: `${fmt(totals.ordered, 1)} kg`, icon: Scale,        color: "text-purple-600", bg: "bg-purple-50", show: isAdmin },
            { label: "Total Received Wt.",  value: `${fmt(totals.received, 1)} kg`,icon: CheckCircle2, color: "text-green-600",  bg: "bg-green-50",  show: isAdmin },
            { label: "Est. Material Value", value: `₹${fmt(totals.value, 0)}`,     icon: DollarSign,   color: "text-amber-600",  bg: "bg-amber-50",  show: isAdmin },
          ].filter(k => k.show).map(k => (
            <article key={k.label} className="industrial-card rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div><p className="industrial-label">{k.label}</p><p className="mt-2 text-2xl font-black text-slate-900">{k.value}</p></div>
                <div className={`rounded-lg p-2 ${k.bg}`}><k.icon className={`h-5 w-5 ${k.color}`} /></div>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* ── Soft-Delete Confirmation Modal ──────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Delete Material</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete <strong className="text-slate-900">&ldquo;{deleteTarget.materialName}&rdquo;</strong>?
            </p>
            <p className="mt-1 text-xs text-slate-400">
              This item will move to the <strong>Deleted Materials</strong> section below.
              It can be permanently removed from there.
            </p>
            {deleteTarget.weightKg && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                ⚠️ This will remove <strong>{deleteTarget.weightKg.toFixed(1)} kg</strong> from the total project weight.
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteItem(deleteTarget)}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Permanent Delete Confirmation Modal ───────────────────────────── */}
      {permTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-red-700">Permanent Delete</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently delete{" "}
              <strong className="text-slate-900">&ldquo;{permTarget.materialName}&rdquo;</strong>{" "}
              from the database.
            </p>
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              ⚠️ This action cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setPermTarget(null)}
                disabled={permDeleting}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => permanentDeleteItem(permTarget)}
                disabled={permDeleting}
                className="flex-1 rounded-lg bg-red-700 py-2.5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {permDeleting ? "Deleting…" : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Form */}
      {showForm && (
        <section className="industrial-card rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Add Procurement Item</h2>
            <button onClick={() => setShowForm(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={handleAdd} className="space-y-4">
            {/* Row 1: category + material name + type */}
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="industrial-label">Category *</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, materialName: "" }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="industrial-label">Material Name *</label>
                <input required value={form.materialName} onChange={e => setForm(f => ({ ...f, materialName: e.target.value }))}
                  placeholder={form.category === "SHEET_METAL" ? "e.g. MS Plate" : form.category === "HARDWARE" ? "e.g. M12 Bolt" : "e.g. 50×50 Angle"}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
              </div>
              <div>
                <label className="industrial-label">Material Type</label>
                <div className="mt-1 flex gap-2">
                  {["MS", "SS", "Others"].map(t => (
                    <button key={t} type="button" onClick={() => setForm(f => ({ ...f, materialType: t }))}
                      className={`flex-1 rounded-lg border py-2 text-xs font-bold transition-colors ${form.materialType === t ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{t}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── SHEET METAL fields ── */}
            {form.category === "SHEET_METAL" && (
              <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Sheet Metal Details</p>
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <label className="industrial-label">Thickness (mm) *</label>
                    <select required value={form.thickness} onChange={e => setForm(f => ({ ...f, thickness: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
                      <option value="">Select</option>
                      {THICKNESS_OPTIONS.map(t => <option key={t} value={t}>{t}mm</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="industrial-label">Sheet Size</label>
                    <select value={form.sheetSize} onChange={e => {
                      const v = e.target.value;
                      const [l, w] = v !== "Custom" ? v.split("x") : ["", ""];
                      setForm(f => ({ ...f, sheetSize: v, lengthMm: l || "", widthMm: w || "" }));
                    }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
                      {SHEET_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {form.sheetSize === "Custom" && (
                    <>
                      <div>
                        <label className="industrial-label">Length (mm)</label>
                        <input type="number" min="0" value={form.lengthMm} onChange={e => setForm(f => ({ ...f, lengthMm: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                      </div>
                      <div>
                        <label className="industrial-label">Width (mm)</label>
                        <input type="number" min="0" value={form.widthMm} onChange={e => setForm(f => ({ ...f, widthMm: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="industrial-label">Quantity (sheets) *</label>
                    <input required type="number" min="0" step="any" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  </div>
                </div>
                {/* Weight preview */}
                {calcedWeight !== null && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-6">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Per Sheet Weight</p>
                        <p className="mt-0.5 text-lg font-black text-emerald-700">{form.quantity ? fmt(calcedWeight / parseFloat(form.quantity), 2) : "—"} kg</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Total Weight</p>
                        <p className="mt-0.5 text-xl font-black text-emerald-700">{calcedWeight} kg</p>
                      </div>
                      {calcedValue && <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Est. Value</p>
                        <p className="mt-0.5 text-xl font-black text-emerald-700">₹{fmt(calcedValue)}</p>
                      </div>}
                      <p className="text-[0.65rem] text-emerald-600 opacity-60">L×W×T×{DENSITY[form.materialType] ?? 7.85}g/cm³×Qty÷1,000,000</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── HARDWARE fields ── */}
            {form.category === "HARDWARE" && (
              <div className="rounded-lg border border-purple-100 bg-purple-50/30 p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-purple-600">Hardware Details</p>
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <label className="industrial-label">Item Type</label>
                    <select value={form.hardwareType} onChange={e => setForm(f => ({ ...f, hardwareType: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
                      {HARDWARE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="industrial-label">Quantity *</label>
                    <input required type="number" min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  </div>
                  <div>
                    <label className="industrial-label">Unit</label>
                    <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
                      {["nos", "pcs", "set", "LS", "kg"].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2 cursor-pointer mt-4">
                      <input type="checkbox" checked={form.isLumpSum} onChange={e => setForm(f => ({ ...f, isLumpSum: e.target.checked, unit: e.target.checked ? "LS" : "nos" }))} className="h-4 w-4 accent-purple-600" />
                      <span className="text-sm font-semibold text-slate-700">Lump Sum (LS)</span>
                    </label>
                  </div>
                </div>
                {/* Manual weight for LS or other hardware */}
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="industrial-label">Weight (kg) <span className="text-slate-400 font-normal">{form.isLumpSum ? "— required for LS" : "— optional"}</span></label>
                    <input type="number" min="0" step="any" value={form.manualWeightKg}
                      onChange={e => setForm(f => ({ ...f, manualWeightKg: e.target.value }))}
                      placeholder="e.g. 12.5"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100" />
                    {form.isLumpSum && <p className="mt-1 text-[0.65rem] text-purple-600">LS entry — enter total weight for this lot</p>}
                  </div>
                  {form.manualWeightKg && (
                    <div className="flex items-end">
                      <div className="rounded-lg bg-purple-50 border border-purple-200 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-purple-600">Entered Weight</p>
                        <p className="mt-0.5 text-lg font-black text-purple-700">{form.manualWeightKg} kg</p>
                        {form.isLumpSum && <span className="text-[0.65rem] font-bold text-purple-500">LUMP SUM</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── ANGLE / PIPE fields ── */}
            {form.category === "ANGLE_PIPE" && (
              <div className="rounded-lg border border-orange-100 bg-orange-50/30 p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Angle / Pipe Details</p>
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <label className="industrial-label">Section Type</label>
                    <select value={form.anglePipeType} onChange={e => setForm(f => ({ ...f, anglePipeType: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
                      {ANGLE_PIPE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="industrial-label">Dimensions</label>
                    <input value={form.dimensions} onChange={e => setForm(f => ({ ...f, dimensions: e.target.value }))} placeholder="e.g. 50×50×5 or Ø25"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  </div>
                  <div>
                    <label className="industrial-label">Length (mm)</label>
                    <input type="number" min="0" value={form.lengthMm} onChange={e => setForm(f => ({ ...f, lengthMm: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  </div>
                  <div>
                    <label className="industrial-label">Quantity *</label>
                    <input required type="number" min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  </div>
                </div>
                {/* Manual weight override */}
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="industrial-label">Weight (kg) <span className="text-slate-400 font-normal">— manual entry</span></label>
                    <input type="number" min="0" step="any" value={form.manualWeightKg}
                      onChange={e => setForm(f => ({ ...f, manualWeightKg: e.target.value }))}
                      placeholder="Total weight of all pieces"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                    <p className="mt-1 text-[0.65rem] text-slate-400">Enter total weight for this batch (qty × unit wt)</p>
                  </div>
                  {form.manualWeightKg && (
                    <div className="flex items-end">
                      <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Total Weight</p>
                        <p className="mt-0.5 text-lg font-black text-orange-700">{form.manualWeightKg} kg</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── MACHINING RAW fields ── */}
            {form.category === "MACHINING_RAW" && (
              <div className="rounded-lg border border-cyan-100 bg-cyan-50/30 p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-600">Machining Raw Material Details</p>
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <label className="industrial-label">Raw Material Type</label>
                    <input value={form.materialName} onChange={e => setForm(f => ({ ...f, materialName: e.target.value }))} placeholder="e.g. EN8 Rod, MS Flat"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  </div>
                  <div>
                    <label className="industrial-label">Size / Dimensions</label>
                    <input value={form.dimensions} onChange={e => setForm(f => ({ ...f, dimensions: e.target.value }))} placeholder="e.g. Ø50×500"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  </div>
                  <div>
                    <label className="industrial-label">Quantity *</label>
                    <input required type="number" min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  </div>
                  <div>
                    <label className="industrial-label">Unit</label>
                    <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
                      {["nos", "pcs", "kg", "mtr"].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                {/* Manual weight */}
                <div>
                  <label className="industrial-label">Weight (kg) <span className="text-slate-400 font-normal">— optional</span></label>
                  <input type="number" min="0" step="any" value={form.manualWeightKg}
                    onChange={e => setForm(f => ({ ...f, manualWeightKg: e.target.value }))}
                    placeholder="Total weight of material"
                    className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" />
                </div>
              </div>
            )}

            {/* ── Generic qty for ELECTRICAL + MISCELLANEOUS ── */}
            {(form.category === "ELECTRICAL" || form.category === "MISCELLANEOUS") && (
              <div className={`rounded-lg border p-4 space-y-3 ${form.category === "ELECTRICAL" ? "border-yellow-100 bg-yellow-50/30" : "border-slate-100 bg-slate-50/30"}`}>
                <p className={`text-xs font-bold uppercase tracking-wider ${form.category === "ELECTRICAL" ? "text-yellow-600" : "text-slate-600"}`}>
                  {form.category === "ELECTRICAL" ? "Electrical Component Details" : "Miscellaneous Details"}
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="industrial-label">Quantity *</label>
                    <input required type="number" min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  </div>
                  <div>
                    <label className="industrial-label">Unit</label>
                    <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
                      {["nos", "pcs", "set", "LS", "kg", "mtr"].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="industrial-label">Weight (kg) <span className="text-slate-400 font-normal">— optional</span></label>
                    <input type="number" min="0" step="any" value={form.manualWeightKg}
                      onChange={e => setForm(f => ({ ...f, manualWeightKg: e.target.value }))}
                      placeholder="Total weight"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                  </div>
                </div>
              </div>
            )}

            {/* Common: rate (admin-only), vendor, notes */}
            <div className={`grid gap-3 ${isAdmin ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              {isAdmin && (
                <div>
                  <label className="industrial-label">Rate / kg (₹, optional)</label>
                  <input type="number" min="0" step="any" value={form.ratePerKg} onChange={e => setForm(f => ({ ...f, ratePerKg: e.target.value }))} placeholder="e.g. 68"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                </div>
              )}
              <div>
                <label className="industrial-label">Vendor</label>
                <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Supplier name"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
              </div>
              <div>
                <label className="industrial-label">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any remarks"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Add Item"}</button>
            </div>
          </form>
        </section>
      )}



      {/* Category tabs — counts from active items only */}
      {selProject && !loading && activeItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveTab("ALL")} className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${activeTab === "ALL" ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>All ({activeItems.length})</button>
          {CATEGORIES.map(c => {
            const cnt = activeItems.filter(i => i.category === c.key).length;
            if (!cnt) return null;
            return (
              <button key={c.key} onClick={() => setActiveTab(c.key)} className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${activeTab === c.key ? `${CAT_COLORS[c.color]} border-current` : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                {c.label} ({cnt})
              </button>
            );
          })}
        </div>
      )}

      {/* Items table */}
      {!selProject ? (
        <div className="industrial-card rounded-xl">
          <div className="erp-empty py-16">
            <Package className="erp-empty-icon h-12 w-12" />
            <p className="erp-empty-title">Select a project</p>
            <p className="erp-empty-sub">Choose a project from the dropdown to manage its procurement.</p>
          </div>
        </div>
      ) : loading ? (
        <div className="industrial-card rounded-xl p-8"><LoadingSpinner label="Loading procurement…" /></div>
      ) : displayItems.length === 0 ? (
        <div className="industrial-card rounded-xl">
          <div className="erp-empty py-12">
            <Package className="erp-empty-icon h-10 w-10" />
            <p className="erp-empty-title">No items yet</p>
            <p className="erp-empty-sub">Click "Add Item" to start tracking materials.</p>
          </div>
        </div>
      ) : (
        <section className="space-y-4">
          {CATEGORIES.filter(c => activeTab === "ALL" || c.key === activeTab).map(cat => {
            const catItems = displayItems.filter(i => i.category === cat.key);
            if (!catItems.length) return null;
            const catWeight = catItems.reduce((s, i) => s + (i.weightKg ?? 0), 0);
            const catValue  = catItems.reduce((s, i) => s + (i.totalValue ?? 0), 0);
            return (
              <div key={cat.key} className="industrial-card rounded-xl overflow-hidden">
                <div className={`flex items-center justify-between px-5 py-3 ${CAT_COLORS[cat.color]} border-b`}>
                  <span className="font-bold">{cat.label} ({catItems.length})</span>
                  {isAdmin && (
                    <div className="flex gap-4 text-xs font-semibold opacity-80">
                      {catWeight > 0 && <span>{fmt(catWeight, 1)} kg total</span>}
                      {catValue > 0 && <span>₹{fmt(catValue, 0)}</span>}
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-left">
                        {["Material", "Type", "Thick", "L×W (mm)", "Qty",
                          ...(isAdmin ? ["Weight", "Rate/kg", "Value"] : []),
                          "Status", "Recv",
                          ...(isAdmin ? ["Actions"] : [])
                        ].map(h =>
                          <th key={h} className="px-3 py-2.5 text-[0.67rem] font-bold uppercase tracking-wider text-slate-500">{h}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {catItems.map((item, idx) => (
                        <React.Fragment key={item.id}>
                          <tr className={`border-t border-slate-100 ${
                            idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                          } ${
                            item.status === "PENDING"  ? "border-l-4 border-l-amber-400"
                            : item.status === "RECEIVED" ? "border-l-4 border-l-green-400"
                            : "border-l-4 border-l-blue-400"
                          }`}>

                            <td className="px-3 py-2.5 font-semibold text-slate-800">
                              {item.materialName}
                              {item.isLumpsum && <span className="ml-1.5 rounded bg-purple-100 px-1 py-0.5 text-[0.6rem] font-bold text-purple-700">LS</span>}
                              {item.notes && <p className="text-[0.65rem] text-slate-400">{item.notes}</p>}
                            </td>
                            <td className="px-3 py-2.5"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-700">{item.materialType}</span></td>
                            <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{item.thickness ? `${item.thickness}mm` : "—"}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{item.lengthMm && item.widthMm ? `${item.lengthMm}×${item.widthMm}` : "—"}</td>
                            <td className="px-3 py-2.5 font-mono font-bold text-slate-900">{item.quantity} <span className="text-xs font-normal text-slate-400">{item.unit}</span></td>
                            {isAdmin && <td className="px-3 py-2.5 font-mono font-bold text-emerald-700">
                              {item.weightKg ? `${fmt(item.weightKg, 1)} kg` : "—"}
                              {item.weightKg && item.category !== "SHEET_METAL" && <span className="ml-1 text-[0.6rem] text-slate-400">manual</span>}
                            </td>}
                            {isAdmin && <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{item.ratePerKg ? `₹${fmt(item.ratePerKg)}` : "—"}</td>}
                            {isAdmin && <td className="px-3 py-2.5 font-mono text-xs font-semibold text-slate-700">{item.totalValue ? `₹${fmt(item.totalValue, 0)}` : "—"}</td>}
                            <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLORS[item.status] ?? "bg-slate-100 text-slate-600"}`}>{item.status}</span></td>
                            <td className="px-3 py-2.5">
                              <div className="w-20">
                                <div className="h-1.5 rounded-full bg-slate-200">
                                  <div className="h-1.5 rounded-full bg-green-500 transition-all" style={{ width: `${Math.min(100, (item.receivedQty / item.quantity) * 100)}%` }} />
                                </div>
                                <p className="mt-0.5 text-[0.6rem] text-slate-500">{item.receivedQty}/{item.quantity}</p>
                              </div>
                            </td>
                            {isAdmin && (
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1">
                                  {item.status !== "ORDERED" && (
                                    <button disabled={updatingId === item.id} onClick={() => updateStatus(item.id, "ORDERED")} className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[0.65rem] font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50">Order</button>
                                  )}
                                  {item.status !== "RECEIVED" && (
                                    <button disabled={updatingId === item.id} onClick={() => updateStatus(item.id, "RECEIVED")} className="rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[0.65rem] font-bold text-green-700 hover:bg-green-100 disabled:opacity-50">Receive</button>
                                  )}
                                  <button onClick={() => setExpandedLog(expandedLog === item.id ? null : item.id)} className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.65rem] font-bold text-slate-600 hover:bg-slate-100">
                                    {expandedLog === item.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  </button>
                                  {/* Soft-Delete button */}
                                  <button
                                    onClick={() => setDeleteTarget(item)}
                                    title="Delete this item"
                                    className="ml-0.5 rounded border border-red-200 bg-red-50 p-1 text-red-600 hover:bg-red-100 transition-colors"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>

                          {/* Log expansion */}
                          {expandedLog === item.id && (
                            <tr key={`${item.id}-log`} className="bg-slate-50">
                              <td colSpan={isAdmin ? 11 : 7} className="px-4 py-3">
                                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500"><Clock className="h-3 w-3" /> Activity Log</p>
                                {item.logs.length === 0 ? (
                                  <p className="text-xs text-slate-400">No log entries yet.</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {[...item.logs].reverse().map(log => (
                                      <div key={log.id} className="flex flex-wrap items-center gap-2 text-xs">
                                        <span className="font-mono text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                                        <span className={`rounded-full px-2 py-0.5 font-bold ${STATUS_COLORS[log.action] ?? "bg-slate-100 text-slate-600"}`}>{log.action}</span>
                                        {log.previousValue && <><span className="rounded bg-red-50 px-1 py-0.5 font-mono text-red-600 line-through">{log.previousValue}</span><span className="text-slate-400">→</span></>}
                                        {log.newValue && <span className="rounded bg-green-50 px-1 py-0.5 font-mono text-green-700">{log.newValue}</span>}
                                        <span className="ml-auto text-slate-400">by {log.updatedBy}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>

                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────
           DELETED MATERIALS SECTION (admin-only, separate from main list)
      ───────────────────────────────────────────────────────────────── */}
      {isAdmin && selProject && deletedItems.length > 0 && (
        <section className="space-y-3">
          {/* Section header */}
          <div className="flex items-center gap-3 border-t border-red-100 pt-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
              <Trash2 className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-red-700">Deleted Materials</h2>
              <p className="text-xs text-slate-400">
                {deletedItems.length} item{deletedItems.length !== 1 ? "s" : ""} — soft-deleted, excluded from all weight calculations.
                Permanently delete below to remove from database.
              </p>
            </div>
          </div>

          {/* Cards grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deletedItems.map(item => {
              const catLabel = CATEGORIES.find(c => c.key === item.category)?.label ?? item.category;
              return (
                <div
                  key={item.id}
                  className="relative overflow-hidden rounded-xl border border-red-100 bg-slate-50 p-4 opacity-70"
                >
                  {/* DELETED badge */}
                  <span className="absolute right-3 top-3 rounded bg-red-100 px-1.5 py-0.5 text-[0.6rem] font-black tracking-wide text-red-600">DELETED</span>

                  {/* Item info */}
                  <p className="pr-16 text-sm font-bold text-slate-500 line-through">{item.materialName}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 font-semibold text-slate-600">{catLabel}</span>
                    <span>{item.quantity} {item.unit}</span>
                    {item.materialType && <span>{item.materialType}</span>}
                  </div>
                  {item.weightKg && (
                    <p className="mt-1 text-xs text-slate-400">
                      Weight: <span className="font-semibold text-slate-500">{item.weightKg.toFixed(1)} kg</span>
                    </p>
                  )}
                  {item.deletedAt && (
                    <p className="mt-0.5 text-[0.65rem] text-slate-400">
                      Deleted: {new Date(item.deletedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  )}

                  {/* Permanent delete button */}
                  <button
                    onClick={() => setPermTarget(item)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete Permanently
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
