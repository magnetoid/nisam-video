
# Implementation Plan for Automation Admin Page Overhaul

## Overview
This plan addresses all identified bugs/errors (e.g., SSE reconnection, desync) and implements the requested enhancements (filtering, bulk ops, dashboard, builder, etc.) in phases. Total scope: Stabilize core, add interactivity, advanced features, testing/docs. We'll use existing patterns (React Query for APIs, Tailwind for UI, Drizzle for DB). No new frameworks unless needed (e.g., react-flow for drag-drop). Phased to allow iterative approval/testing. Effort: ~35-50 hours, broken into todos. Post-plan: Run migrations, lint/typecheck, E2E tests. Meets goals: Sub-3s loads (lazy/chunking), 99.9% uptime (health checks/retry), WCAG AA (ARIA/contrast audits).

## Phase 1: Bug Fixes and Stabilization (High Priority - 4-6 hours)
Focus: Resolve critical/high issues for reliable monitoring. Verify with manual tests (start job → monitor → complete).

- **Todo 1.1: Enhance SSE Reconnection and Error Handling** (AdminAutomation.tsx, automation.ts)
  - Add exponential backoff retry (3 attempts, 1s/2s/4s) in useEffect (line 106); use AbortController for cleanup.
  - Implement onerror handler: Show toast ("Connection lost—reconnecting"), fallback to polling (refetchInterval: 5s).
  - Backend: Add keep-alive pings every 30s in SSE (res.write(':\n\n')); structured errors (JSON {error: msg}).
  - UX: Add ErrorBoundary wrapper; loading skeletons for progress/logs.

- **Todo 1.2: Fix Job Desync and Status Transitions** (AdminAutomation.tsx, scheduler.ts, job-queue.ts)
  - Invalidate queries on stream close/completion (queryClient.invalidateQueries in useEffect return).
  - Update ScrapeJob type/schema to handle transitions (add transitioning: boolean); backend: Emit 'job_complete' event.
  - Parse errors robustly: Use JSON.parse on errorMessage if possible; count via logs query.

- **Todo 1.3: API Validation and Route Hardening** (automation.ts)
  - Add Zod schemas for req.body (/jobs/start: z.object({type: z.enum(['full', 'incremental']), ...})); 400 on invalid.
  - Consistent requireAuth; structured 500 responses ({error: msg, code: 'JOB_FETCH_FAILED'}).
  - Add /health endpoint for uptime monitoring (return {status: 'ok', activeJobs: count}).

- **Todo 1.4: UI Polish and Accessibility Fixes** (AdminAutomation.tsx)
  - Add ARIA: role="log" on logs div, aria-live="polite" on progress, keyboard nav (up/down for logs).
  - Responsive: Use Tailwind sm/md classes for table (e.g., hidden cols on mobile); virtualize logs with react-window if >1000.
  - i18n: Wrap strings in useTranslation (e.g., t('automation.noJob')).

- **Verification**: RunCommand: `npm run dev`; manual: Start job, simulate disconnect (kill server), confirm reconnect/toast. GetDiagnostics: Clean TS.

## Phase 2: Core Enhancements (UX/Interactivity - 10-15 hours)
Build on monitoring: Add filtering, bulk, better errors, scheduling UI. Test: Unit for utils (parseErrorCount), integration for queries.

- **Todo 2.1: Advanced Filtering and Search** (AdminAutomation.tsx, automation.ts)
  - UI: Add Toolbar with Input (search by channel/error), Select (status: running/failed), DateRangePicker (startedAt).
  - Backend: /jobs?search=query&status=failed&dateFrom=ISO → Drizzle where clauses (ilike(title, `%${search}%`), eq(status)).
  - Debounce search (300ms); persist filters in URL (useSearchParams).

- **Todo 2.2: Bulk Operations** (AdminAutomation.tsx, new mutations)
  - Table: Add Checkbox column; Select All button.
  - Mutations: Retry selected failed jobs (POST /jobs/:id/retry), Delete (DELETE /jobs/:id), Pause running (POST /jobs/:id/pause).
  - Backend: Bulk endpoints (e.g., POST /jobs/bulk/retry {ids: []}); use jobQueue.batchProcess.
  - UX: Confirm dialogs (Dialog from shadcn); toast success/fail counts.

- **Todo 2.3: Real-Time Status Monitoring with Analytics Dashboard** (AdminAutomation.tsx, performance-metrics.ts extension)
  - New Tab: Switch between Monitor/History/Analytics (Tabs component).
  - Dashboard: Recharts LineChart (videosAdded over time), BarChart (errors by channel); query /api/automation/analytics?period=7d.
  - Backend: New route /analytics: Aggregate from scrapeJobs (sum(videosAdded), group by date/hour); rolling 7d/30d.
  - Real-time: SSE for metrics updates (emit 'metrics_update' on job end).

- **Todo 2.4: Improved Error Handling and Scheduling** (AdminAutomation.tsx, scheduler.ts)
  - User-friendly: Categorize errors (network/DB/scrape); Retry button per error log.
  - Scheduling UI: Form for intervalHours (Slider 1-24), Timezone Select (e.g., 'UTC', 'Europe/Belgrade'); cron update on save (POST /scheduler/config).
  - Backend: Store tz in settings; use node-cron with tz support.

- **Verification**: E2E with Playwright: Filter jobs → Bulk retry → See dashboard update. Perf: Lighthouse audit (<3s load).

## Phase 3: Advanced Features (Builder/Integrations - 15-20 hours)
Major additions: Drag-drop, external tools, version control, audit logs. Scope: New components/routes.

- **Todo 3.1: Drag-and-Drop Workflow Builder** (New: WorkflowBuilder.tsx)
  - Canvas: Use react-flow for nodes (e.g., "Source: YouTube", "Filter: Tags", "Action: Save"); edges for flow.
  - Save/Load: Serialize to JSON, store in new DB table automation_workflows (id, name, flow: jsonb).
  - Integration: Run workflow via /automation/workflows/:id/run → Translate to jobQueue tasks.
  - UX: Toolbar for node types; validation (required edges); preview mode.

- **Todo 3.2: External Integrations and Version Control** (automation.ts, new schema)
  - Webhooks: POST /webhooks/automation {event: 'job_complete', payload} → Forward to user URLs (store in settings).
  - Version Control: For workflows/scripts—new table automation_versions (workflowId, version: int, script: text, diff: jsonb); UI diff viewer (monaco-editor).
  - Integrations: OAuth buttons for Zapier/Make (redirect to /auth/:provider); store tokens encrypted (not in repo).

- **Todo 3.3: Comprehensive Audit Logging** (schema.ts, automation.ts)
  - Extend scrapeJobs: Add audit_logs jsonb[] (e.g., {action: 'start', userId, timestamp}).
  - Route: /audit?filter=userX → Paginated query; UI table with export CSV.
  - Retention: Prune >90d logs via cron.

- **Verification**: Manual: Build workflow → Run → See audit log. Security: No secrets logged.

## Phase 4: Testing, Documentation, and Compliance (8-10 hours)
Ensure quality; no prod deploy without this.

- **Todo 4.1: Implement Tests**
  - Units: Vitest for utils (parseErrorCount, formatDurationSeconds); components (render progress bar).
  - Integration: Test queries/mutations (msw for API mocks); SSE simulation.
  - E2E: Playwright—login → Nav to automation → Start job → Filter → Bulk action → Assert updates.
  - Coverage: >80%; run `npm test`.

- **Todo 4.2: Error Boundaries, Loading, Responsive**
  - Add <ErrorBoundary fallback={<Toast error />}> around page.
  - Skeletons: For cards/table (shimmer effect).
  - Mobile: Test on 320px; adjust sidebar (off-canvas on small).

- **Todo 4.3: Performance and Accessibility**
  - Bundle: Code-split dashboard/charts (lazy import).
  - Uptime: Add /health to monitoring; alert on >1% failure (future: integrate Sentry).
  - WCAG: Run axe-core; fix contrasts (e.g., badges), add alt/aria. Keyboard: Focus trap for modals.

- **Todo 4.4: Update Documentation**
  - New: docs/automation.md—Guides: "Using the Builder", "Bulk Ops", "Integrations Setup"; screenshots via OpenPreview.
  - Update README: Link to new features; migration notes (e.g., add workflows table).

## Risks and Milestones
- Risks: Drag-drop complexity (fallback to simple form if time-constrained); integrations security (audit tokens).
- Milestones: Phase 1 complete → Test stability. Phase 2 → UX review. Full → E2E pass, deploy.
- Post-Approval: Use TodoWrite to track; run lint/typecheck; commit only on explicit ask.

Approve to proceed phase-by-phase!
