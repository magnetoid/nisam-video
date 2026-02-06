
## Phase 1: Extract Duplicates (High, 5h)
- **1.1** utils/logger.ts: Centralize appendLog (scheduler/job-queue/scrape-job-logs).
- **1.2** storage/jobUtils.ts: updateStatus/progress (used 10+ places).
- **1.3** utils/sseUtils.ts: pollJobStatus/writeEvent (automation.ts dup).
- Verif: Grep calls → utils; no regressions.

## Phase 2: Naming & Conventions (Medium, 4h)
- **2.1** Rename: isEnabled→isActive (bool), tick→pollJob, runScrapeJob→executeBatch.
- **2.2** Async prefixes (fetch*Job), camelCase SQL aliases.
- Verif: ESLint naming rule pass.

## Phase 3: Break Large Functions (High, 10h)
- **3.1** scheduler.ts: executeBatch → initJob/processParallelChannels/finalizeJob (Promise.allSettled).
- **3.2** database.ts: hydrateVideos → batchChannels/batchTags/batchCategories.
- **3.3** AdminAutomation.tsx: Extract JobCard/LogViewer/FilterToolbar/BulkActions (new components/).
- Verif: LOC <60/func; JSDoc added.

## Phase 4: Perf & Errors (Medium, 5h)
- **4.1** Parallelize scheduler loops (Promise.allSettled, concurrency limit).
- **4.2** logger.error everywhere (structured {jobId, level}).
- **4.3** React: useCallback memos (eta/speed), virtualize logs (react-window).
- Verif: Benchmark 20% faster; error rates 0.

## Phase 5: Tests (High, 5h)
- **5.1** Vitest: utils.test.ts (logger/jobUtils 100%), scheduler.test.ts (mock db).
- **5.2** Coverage: vitest --coverage >90%; Playwright AdminAutomation (filter/bulk).
- Verif: npm test pass 100%.

## Phase 6: Docs/Report (Low, 1h)
- **6.1** JSDoc all exports; README refactor section.
- **6.2** Report: Table (file|change|rationale|LOC saved|perf gain).
- Verif: Doc coverage 100%.

Risks: None (atomic commits). Post: npm run check clean.
