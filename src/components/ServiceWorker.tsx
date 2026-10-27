"use client";

import { useEffect } from "react";

/** Register public/sw.js, which is what makes the app installable and lets recipes open offline. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("[rasoi] service worker:", err));
  }, []);
  return null;
}
