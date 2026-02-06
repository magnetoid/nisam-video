type RouteKey = string;

type RouteStats = {
  count: number;
  errorCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
  durations: number[];
  lastSeen: number;
};

const MAX_DURATIONS_PER_ROUTE = 200;

const statsByRoute = new Map<RouteKey, RouteStats>();

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

export function recordRequestMetric(input: {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}) {
  const key = `${input.method.toUpperCase()} ${input.path}`;
  const now = Date.now();
  const existing = statsByRoute.get(key);
  const stat: RouteStats =
    existing || {
      count: 0,
      errorCount: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      durations: [],
      lastSeen: now,
    };

  stat.count += 1;
  if (input.statusCode >= 500) stat.errorCount += 1;
  stat.totalDurationMs += input.durationMs;
  stat.maxDurationMs = Math.max(stat.maxDurationMs, input.durationMs);
  stat.lastSeen = now;
  stat.durations.push(input.durationMs);
  if (stat.durations.length > MAX_DURATIONS_PER_ROUTE) {
    stat.durations.splice(0, stat.durations.length - MAX_DURATIONS_PER_ROUTE);
  }

  statsByRoute.set(key, stat);
}

export function getPerformanceSummary() {
  const routes = Array.from(statsByRoute.entries()).map(([route, s]) => {
    const sorted = [...s.durations].sort((a, b) => a - b);
    const avg = s.count > 0 ? s.totalDurationMs / s.count : 0;
    return {
      route,
      count: s.count,
      errorCount: s.errorCount,
      avgMs: Math.round(avg),
      p50Ms: Math.round(percentile(sorted, 0.5)),
      p95Ms: Math.round(percentile(sorted, 0.95)),
      maxMs: Math.round(s.maxDurationMs),
      lastSeen: new Date(s.lastSeen).toISOString(),
    };
  });

  const slowestByP95 = [...routes].sort((a, b) => b.p95Ms - a.p95Ms).slice(0, 15);
  const slowestByAvg = [...routes].sort((a, b) => b.avgMs - a.avgMs).slice(0, 15);

  return {
    routeCount: routes.length,
    slowestByP95,
    slowestByAvg,
  };
}

