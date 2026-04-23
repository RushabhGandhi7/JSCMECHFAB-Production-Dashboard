"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/Toast";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
      const payload = await response.json();
      setError(payload.message ?? "Invalid email or password.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-900 shadow-lg">
        <h1 className="text-xl font-semibold">JSC MECH FAB LLP</h1>
        <input name="email" type="email" required className="w-full rounded border border-slate-300 bg-white p-2" placeholder="Email" />
        <input
          name="password"
          type="password"
          required
          className="w-full rounded border border-slate-300 bg-white p-2"
          placeholder="Password"
        />
        {error ? <Toast message={error} kind="error" /> : null}
        <button disabled={loading} className="w-full rounded bg-emerald-600 p-2 font-medium disabled:opacity-60">{loading ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
  );
}
