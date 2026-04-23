"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="max-w-lg rounded border border-red-200 bg-white p-6 shadow">
        <h2 className="mb-2 text-xl font-semibold text-red-700">Something went wrong</h2>
        <p className="mb-4 text-sm text-slate-600">{error.message}</p>
        <button onClick={reset} className="rounded bg-slate-900 px-4 py-2 text-white">
          Retry
        </button>
      </div>
    </main>
  );
}
