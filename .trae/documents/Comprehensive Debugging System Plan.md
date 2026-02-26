# Comprehensive Debugging System Implementation Plan

This plan outlines the steps to implement a robust debugging infrastructure as requested.

## 1. Foundation: Structured Logging
- **Objective:** Replace ad-hoc `console.log` with a structured logging system.
- **Tasks:**
    - Create `server/lib/logger.ts`:
        - Support log levels: `debug`, `info`, `warn`, `error`.
        - Format: JSON (production), Pretty Print (development).
        - Context: Request ID, User ID, Timestamp.
    - Create `client/src/lib/logger.ts`:
        - Mirror server logger for consistency.
        - Configurable log level (e.g., via localStorage or URL param).

## 2. Centralized Error Handling & Storage
- **Objective:** Capture and store all errors with context.
- **Tasks:**
    - Enhance `server/middleware/error-handler.ts`:
        - Use `logger.error`.
        - Persist to `error_events` table (ensure schema supports all fields).
    - Update `client/src/lib/errorReporting.ts`:
        - Ensure it sends full stack, component stack, and user state.
    - Database:
        - Verify `error_events` table has JSON `context` and `metadata` columns.

## 3. Real-Time Debugging Dashboard
- **Objective:** One-stop shop for system health.
- **Tasks:**
    - Create `client/src/pages/AdminDebugDashboard.tsx`:
        - **Live Error Feed:** Poll `error_events` every 5s.
        - **System Health:** CPU/Memory usage (via new API endpoint), Database connection status.
        - **Performance:** Chart API response times (from `performance-metrics.ts`).
    - Add "AI Analyze" button to error details:
        - Connects to Ollama/AI service to explain error and suggest fixes.

## 4. Automated Error Detection & Monitoring
- **Objective:** Proactive detection.
- **Tasks:**
    - Create background job (`server/jobs/error-monitor.ts`):
        - Check for error spikes (e.g., > 10 errors/min).
        - Check for slow queries/requests.
    - Alerting:
        - For now, log a "CRITICAL" alert to the dashboard.

## 5. Debugging Tools & Developer Experience
- **Objective:** Improve "vibe coding" workflow.
- **Tasks:**
    - Create `.vscode/launch.json`:
        - Configurations for Server (Attach/Launch) and Client (Chrome).
    - Create `client/src/components/DebugOverlay.tsx`:
        - Floating button (dev only) showing: Current Route, User, Query Cache stats.

## 6. Testing Pipeline
- **Objective:** Ensure reliability.
- **Tasks:**
    - Update `package.json`: Add `test:all` script.
    - Create `tests/e2e/`: Add basic Puppeteer sanity checks (Login, Home load).

## 7. Documentation
- **Objective:** Knowledge sharing.
- **Tasks:**
    - Create `docs/debugging.md`.

## Execution Order
1.  **Setup Loggers** (Server & Client).
2.  **Enhance Middleware** (Error & Performance).
3.  **Build Dashboard** (Backend API + Frontend UI).
4.  **Add AI Analysis**.
5.  **Add Dev Tools** (VS Code + Overlay).
6.  **Docs & Verification**.
