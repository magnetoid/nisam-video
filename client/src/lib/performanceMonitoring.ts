type PerfPayload = {
  type: "perf";
  page: string;
  timestamp: string;
  metrics: Record<string, number | string | boolean | null>;
};

function postClientLog(payload: PerfPayload): void {
  try {
    const body = JSON.stringify({
      error: null,
      info: payload,
      url: typeof window !== "undefined" ? window.location.href : "",
    });

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/client-logs", blob);
      return;
    }

    fetch("/api/client-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "include",
    }).catch(() => {});
  } catch {
    return;
  }
}

export function initPerformanceMonitoring(): void {
  if (typeof window === "undefined") return;
  if (!import.meta.env.PROD) return;

  const metrics: Record<string, number | string | boolean | null> = {
    lcp: null,
    fid: null,
    cls: 0,
    longTaskTotalMs: 0,
    longTaskMaxMs: 0,
  };

  let clsValue = 0;

  try {
    if ("PerformanceObserver" in window) {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1] as any;
        if (last?.startTime != null) metrics.lcp = Math.round(last.startTime);
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true } as any);

      const fidObserver = new PerformanceObserver((list) => {
        const entry = list.getEntries()[0] as any;
        if (!entry) return;
        const fid = entry.processingStart - entry.startTime;
        metrics.fid = Math.max(0, Math.round(fid));
      });
      fidObserver.observe({ type: "first-input", buffered: true } as any);

      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry || entry.hadRecentInput) continue;
          clsValue += entry.value;
        }
        metrics.cls = Math.round(clsValue * 1000) / 1000;
      });
      clsObserver.observe({ type: "layout-shift", buffered: true } as any);

      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          const duration = typeof entry?.duration === "number" ? entry.duration : 0;
          metrics.longTaskTotalMs = (metrics.longTaskTotalMs as number) + duration;
          metrics.longTaskMaxMs = Math.max(metrics.longTaskMaxMs as number, duration);
        }
        metrics.longTaskTotalMs = Math.round(metrics.longTaskTotalMs as number);
        metrics.longTaskMaxMs = Math.round(metrics.longTaskMaxMs as number);
      });
      longTaskObserver.observe({ type: "longtask", buffered: true } as any);
    }
  } catch {
    return;
  }

  window.addEventListener(
    "load",
    () => {
      try {
        const nav = performance.getEntriesByType("navigation")[0] as any;
        if (nav) {
          metrics.ttfb = Math.round(nav.responseStart);
          metrics.domContentLoaded = Math.round(nav.domContentLoadedEventEnd);
          metrics.load = Math.round(nav.loadEventEnd);
          metrics.transferSize = typeof nav.transferSize === "number" ? nav.transferSize : null;
        }

        postClientLog({
          type: "perf",
          page: window.location.pathname,
          timestamp: new Date().toISOString(),
          metrics,
        });
      } catch {
        return;
      }
    },
    { once: true },
  );
}

