"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on mount.
 * Runs only in browser (useEffect), never on server.
 * Safe to render in root layout.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Register SW after page load so it doesn't compete with initial resources
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          console.log("[JSC ERP SW] Registered, scope:", registration.scope);

          // Check for updates periodically
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // New SW is ready — silently update on next navigation
                  console.log("[JSC ERP SW] Update available");
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn("[JSC ERP SW] Registration failed:", err);
        });
    });
  }, []);

  return null; // Renders nothing — purely functional
}
