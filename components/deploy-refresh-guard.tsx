"use client";

import { useEffect } from "react";

// Next.js's client-side router fetches JS chunks/RSC payloads keyed to the
// build that was active when the tab first loaded. After a redeploy, an
// already-open tab's stale client tries to fetch assets that no longer
// exist on the server -- clicking a nav link can then silently do nothing
// instead of navigating. This catches that specific failure class (chunk
// load errors) and forces a full reload, so a stale tab self-heals on the
// next click instead of requiring a manual hard refresh.
//
// Deliberately narrow: only matches chunk-loading failures, not generic
// "Failed to fetch" (which is also what an ordinary flaky external API
// call looks like, and this app makes plenty of those) -- a broad match
// would cause unwanted reloads whenever, say, Binance is briefly slow.
function isStaleBuildError(name?: string, message?: string) {
  if (name === "ChunkLoadError") return true;
  const text = message ?? "";
  return /Loading (chunk|CSS chunk) [\w.-]+ failed/i.test(text) || /dynamically imported module/i.test(text);
}

export function DeployRefreshGuard() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (isStaleBuildError(event.error?.name, event.message)) {
        window.location.reload();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const name = typeof reason === "object" ? reason?.name : undefined;
      const message = typeof reason === "object" ? reason?.message : String(reason ?? "");
      if (isStaleBuildError(name, message)) {
        window.location.reload();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
