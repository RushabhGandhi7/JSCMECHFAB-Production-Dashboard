"use client";

export function Toast({
  message,
  kind
}: {
  message: string;
  kind: "success" | "error";
}) {
  if (!message) return null;
  const className =
    kind === "success"
      ? "border-green-300 bg-green-50 text-green-700"
      : "border-red-300 bg-red-50 text-red-700";
  return <div className={`rounded-lg border px-4 py-3 text-sm font-medium shadow ${className}`}>{message}</div>;
}
