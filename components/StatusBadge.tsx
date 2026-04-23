import clsx from "clsx";

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.replaceAll("_", " ");
  const color =
    value === "DISPATCHED"
      ? "bg-violet-100 text-violet-800"
      : value.includes("COMPLETED") || value.includes("RECEIVED") || value.includes("APPROVED")
        ? "bg-green-100 text-green-800"
        : value.includes("IN_PROGRESS") || value.includes("IN_PRODUCTION") || value.includes("ORDERED") || value.includes("IN_TRANSIT")
          ? "bg-blue-100 text-blue-800"
          : value.includes("DELAYED") || value.includes("PENDING")
            ? "bg-red-100 text-red-800"
            : "bg-slate-100 text-slate-800";
  return (
    <span className={clsx("erp-badge", color)}>
      {normalized}
    </span>
  );
}
