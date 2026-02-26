# Comprehensive Debugging Guide

This document outlines the debugging infrastructure, tools, and procedures for the Nisam Video application.

## 1. Overview

The system includes a robust set of tools for identifying, analyzing, and resolving errors across the full stack:
- **Centralized Logging:** Unified error storage in Postgres (`error_events`).
- **Real-Time Dashboard:** Live feed of errors and system health metrics.
- **Developer Tools:** VS Code launch configurations and in-app debug overlay.
- **AI Analysis:** Automated insights into error causes and fixes.

## 2. Logging Architecture

### Backend
- **Logger:** Located in `server/lib/logger.ts`.
- **Levels:** `debug`, `info`, `warn`, `error`.
- **Output:**
    - **Development:** Pretty-printed console logs.
    - **Production:** JSON-formatted logs to stdout (and optional file).
- **Usage:**
  ```typescript
  import { logger } from "./lib/logger";
  logger.info("Processing video", { videoId: 123 });
  logger.error("Failed to process", error);
  ```

### Frontend
- **Logger:** `client/src/lib/logger.ts`.
- **Reporting:** Unhandled exceptions are automatically captured by `ErrorReporter` and sent to the backend.
- **Context:** Includes URL, User Agent, and Component Stack.

## 3. Debugging Dashboard

Access: `/admin/debug` (Requires Admin Login)

**Features:**
- **System Health:** Database status, Cache hit rates, Memory usage.
- **Live Error Feed:** Auto-refreshing list of recent exceptions.
- **AI Analysis:** Click any error to get an AI-generated explanation and suggested fix.

## 4. Developer Tools

### VS Code Debugging
A `.vscode/launch.json` is provided.
1. Go to "Run and Debug" tab in VS Code.
2. Select **"Full Stack Debug"**.
3. This will launch the server in debug mode and open a Chrome instance attached to the debugger.

### Client Debug Overlay
- **Trigger:**
    - Automatically visible in `development` mode.
    - Force enable in production by adding `?debug=true` to the URL.
- **Features:**
    - View current route and params.
    - Monitor React Query cache status (stale/fetching).
    - Check Backend connection latency.

## 5. Testing

- **Unit Tests:** `npm test` (Vitest)
- **Watch Mode:** `npm run test:watch`
- **Coverage:** `npm run test:coverage`

## 6. Common Procedures

### Investigating a "Black Screen" or Crash
1. Open the **Debug Dashboard** (`/admin/debug`).
2. Check "Live Error Feed" for recent `client_error` events.
3. Use the **AI Analyze** button to understand the stack trace.
4. If reproducible locally, use the **Debug Overlay** to check if API requests are failing.

### Debugging Slow Performance
1. Check **System Health** cards for high Memory or low Cache Hit Rate.
2. Look at **Performance Metrics** in the dashboard (coming soon).
3. Use `npm run test:coverage` to ensure critical paths are optimized.

## 7. Error Recovery

- **Frontend:** The app is wrapped in an `AppErrorBoundary` that catches render crashes and offers a "Reload" button.
- **Backend:** Global error middleware catches async errors and returns standardized JSON responses.
- **Database:** The connection pool automatically reconnects on error.
