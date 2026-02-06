type ClientErrorLevel = "debug" | "info" | "warn" | "error" | "critical";

type ClientErrorPayload = {
  level: ClientErrorLevel;
  type: string;
  message: string;
  stack?: string;
  module?: string;
  url?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  sessionId?: string;
  context?: unknown;
};

const recent = new Map<string, number>();

function redactKey(key: string): boolean {
  return /(authorization|cookie|password|token|secret|apikey|api_key|set-cookie)/i.test(
    key,
  );
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === "string") return value.length > 10000 ? `${value.slice(0, 10000)}…` : value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).slice(0, 50)) {
      out[k] = redactKey(k) ? "[redacted]" : sanitize(obj[k], depth + 1);
    }
    return out;
  }
  return String(value);
}

function fingerprintFor(p: ClientErrorPayload): string {
  const base = [
    p.type,
    p.module || "",
    p.message,
    p.stack || "",
    p.method || "",
    p.url || "",
    p.statusCode ? String(p.statusCode) : "",
  ].join("|");
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  }
  return String(hash);
}

export function reportClientError(payload: ClientErrorPayload) {
  try {
    const fp = fingerprintFor(payload);
    const now = Date.now();
    const last = recent.get(fp);
    if (last && now - last < 15000) return;
    recent.set(fp, now);

    const body = {
      ...payload,
      url: payload.url || window.location.href,
      userAgent: navigator.userAgent,
      context: sanitize(payload.context),
    };

    fetch("/api/public/error-logs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
      credentials: "include",
    }).catch(() => {});
  } catch {
  }
}

