
# Refactor Plan: Improve Structure, Readability, Maintainability

## Goals & Scope
Preserve 100% functionality. Target: 90% coverage, <10 LOC/function avg, consistent naming, structured errors. Phases with todos for tracking.

## Phase 1: Extract Duplicates (Priority: High, 4h)
- **Todo 1.1**: utils/logger.ts - Unify appendScrapeJobLog calls (scheduler/job-queue).
- **Todo 1.2**: storage/jobHelpers.ts - Centralize updateStatus/progress.
- **Todo 1.3**: utils/sseHelpers.ts - Dedup tick/writeEvent (automation.ts).
- Verif: Lint clean, no regressions.

## Phase 2: Rename Conventions (Medium, 3h)
- **Todo 2.1**: Bool fields (isEnabled→isActive), funcs (runScrapeJob→executeBatch).
- **Todo 2.2**: Async prefixes, snake→camel SQL aliases.
- Verif: grep naming patterns.

## Phase 3: Break Large Functions (High, 8h)
- **Todo 3.1**: scheduler.ts runScrapeJob → init/process/finalize (Promise.allSettled).
- **Todo 3.2**: AdminAutomation.tsx → JobCard/LogViewer/FilterToolbar components.
- **Todo 3.3**: database.ts hydrate → batch* utils.
- Verif: Single responsibility (<50 LOC).

## Phase 4: Perf & Errors (Medium, 5h)
- **Todo 4.1**: Parallel loops (channels).
- **Todo 4.2**: logger.error everywhere; Sentry init.
- **Todo 4.3**: React memos/callbacks.
- Verif: Benchmark timings.

## Phase 5: Tests (High, 8h)
- **Todo 5.1**: Vitest utils/scheduler (90% coverage).
- **Todo 5.2**: Playwright AdminAutomation flows.
- Verif: npm test --coverage.

## Phase 6: Docs/Report (Low, 2h)
- **Todo 6.1**: JSDoc all.
- **Todo 6.2**: CHANGELOG + report (table: change/rationale/impact).
- Verif: 100% doc coverage.

Post: npm run check, commit summary.
