"use client";

import { useEffect, useState } from "react";
import { Toast } from "@/components/Toast";

export function HealthPing() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/health")
      .then((r) => r.json().catch(() => null))
      .then((payload) => {
        if (!mounted) return;
        if (!payload?.success) setError(payload?.message ?? "Database health check failed");
      })
      .catch(() => {
        if (!mounted) return;
        setError("Database health check failed");
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!error) return null;
  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-lg">
      <Toast kind="error" message={error} />
    </div>
  );
}

