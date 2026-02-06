import { useEffect } from "react";
import { reportClientError } from "@/lib/errorReporting";

export function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportClientError({
        level: "error",
        type: "js_exception",
        message: event.error?.message || event.message || "Unknown error",
        stack: event.error?.stack,
        module: "frontend",
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason: any = event.reason;
      reportClientError({
        level: "error",
        type: "unhandled_rejection",
        message: reason?.message || String(reason),
        stack: reason?.stack,
        module: "frontend",
        context: { reason: reason && typeof reason === "object" ? reason : String(reason) },
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

