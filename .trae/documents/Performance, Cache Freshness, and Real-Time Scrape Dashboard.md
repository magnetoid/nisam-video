## Findings (Current Bottlenecks & Freshness Failures)
- **Multi-layer caching causes stale videos**: public GETs like `/api/videos` and `/api/videos/carousels` are cached server-side for 10 minutes via [cache-middleware.ts](file:///Users/magnetoid/nisam-video/nisam-video/server/cache-middleware.ts#L12-L25), while the client also caches for 10 minutes and won’t refetch on tab focus via [queryClient.ts](file:///Users/magnetoid/nisam-video/nisam-video/client/src/lib/queryClient.ts#L66-L174). This stacks into “scrape succeeded but UI still shows old content”.
- **HTTP cache invalidation gap**: cache invalidation middleware exists but is only wired for some admin mutations; scrape/ingestion paths don’t reliably purge `http:` keys, so cached `/api/videos*` stays stale until TTL.
- **Storage cache invalidation gaps**:
  - New videos invalidate `videos:` keys but not `home:hero:` keys used by [getHomeHeroVideos](file:///Users/magnetoid/nisam-video/nisam-video/server/storage/database.ts#L979-L1028), so Home hero can stay stale.
  - Channel platform cache keys (`channels:platform:*`) are never invalidated by channel mutations.
- **JobQueue bypasses storage invalidation**: [job-queue.ts](file:///Users/magnetoid/nisam-video/nisam-video/server/services/job-queue.ts#L131-L190) inserts directly into `videos/channels` using `db`, skipping `storage.createVideo` invalidation.
- **Database query inefficiencies**:
  - `getAllVideos()` hydrates relations with per-video queries (N+1) (see [database.ts](file:///Users/magnetoid/nisam-video/nisam-video/server/storage/database.ts#L389-L456)).
  - `/api/videos?limit=` slices after fetching all videos (wasted work) ([videos.ts](file:///Users/magnetoid/nisam-video/nisam-video/server/routes/videos.ts#L13-L35)).
  - Scheduler uses `storage.getAllVideos({ channelId })` per channel to build `existingVideoIds`, which is expensive because it hydrates relations (see [scheduler.ts](file:///Users/magnetoid/nisam-video/nisam-video/server/scheduler.ts#L146-L154)).
- **Sorting can look stale**: most lists order by `videos.publishDate` which is `text` and can be relative strings, so “new” inserts may not appear where users expect.
- **Schema drift**: migration `0002_enhance_scrape_jobs.sql` adds columns (`type/progress/logs/...`) but [schema.ts](file:///Users/magnetoid/nisam-video/nisam-video/shared/schema.ts#L183-L199) doesn’t include them, while [job-queue.ts](file:///Users/magnetoid/nisam-video/nisam-video/server/services/job-queue.ts#L28-L45) uses them.

## Plan
### 1) Fix the “scraped but not displayed” synchronization breakdown
- Add a single **video-content invalidation helper** that clears:
  - Server HTTP cache keys: `^http:/api/videos`, `^http:/api/videos/carousels`, `^http:/api/categories`, `^http:/api/tags`, `^http:/api/channels`.
  - Storage-level keys: `videos:` plus `home:hero:` (and any other home keys).
- Invoke this helper from:
  - `storage.createVideo/updateVideo/deleteVideo`.
  - Scrape endpoints (`POST /channels/:id/scrape`, TikTok scrape) and scheduler “run now” endpoint.
  - JobQueue completion (and/or refactor JobQueue to use shared ingestion/storage methods).
- Adjust client caching for freshness-critical surfaces:
  - Reduce `staleTime` specifically for the Home carousels query and `/api/videos` feeds, and/or enable `refetchOnWindowFocus` for those queries only.

### 2) Make scrape job tracking consistent (schema + data model)
- Update [shared/schema.ts](file:///Users/magnetoid/nisam-video/nisam-video/shared/schema.ts) to include the `scrape_jobs` columns added by migration 0002.
- Harmonize scheduler + job-queue semantics by mapping:
  - `totalChannels/processedChannels/videosAdded/errorMessage` (scheduler) and `totalItems/processedItems/failedItems/logs` (job queue) into a single enriched job record.

### 3) Implement real-time scraping dashboard (admin)
- Add an authenticated SSE endpoint under `/api/automation` (patterned after the existing error-log stream in [admin.ts](file:///Users/magnetoid/nisam-video/nisam-video/server/routes/admin.ts)):
  - `GET /api/automation/jobs/:id/stream` emits structured events: `job_snapshot`, `channel_start`, `channel_done`, `video_saved`, `error`, `log`.
- Instrument the scheduler loop ([scheduler.ts](file:///Users/magnetoid/nisam-video/nisam-video/server/scheduler.ts)) to write:
  - Real counters: channels attempted/succeeded/failed, videos found/saved/skipped, per-channel durations, throughput (videos/min, channels/min).
  - Append log entries into `scrape_jobs.logs` for persistence and replay.
- Upgrade [AdminAutomation.tsx](file:///Users/magnetoid/nisam-video/nisam-video/client/src/pages/AdminAutomation.tsx) to use SSE (fallback to polling):
  - Progress bars: channels + optional “items” progress.
  - Counters: success/failure, videos found/saved/skipped, errors.
  - Speed metrics: current + rolling average.
  - A live log viewer (auto-scroll, filter by level/channel, export).

### 4) Backend performance optimizations (DB + scraping)
- Replace N+1 hydration in `getAllVideos()` with a batched strategy:
  - Use the existing `hydrateVideosWithRelations` path, then batch tags/categories lookups (no per-video tag queries).
- Push pagination to SQL:
  - `/api/videos` should pass `limit/offset` into `storage.getAllVideos` rather than slicing.
- Add lightweight storage methods for scraping/scheduler:
  - `getVideoIdsByChannel(channelId)` (select only `videoId`) to avoid hydrating relations.
  - `countVideosByChannel(channelId)` to avoid loading full rows.
- Add/adjust indexes as needed (likely `videos.created_at`, `channels.last_scraped`), and consider a stable `publishedAt` timestamp for correct ordering.

### 5) Frontend rendering optimizations
- Stop fetching “all videos” for Popular/Categories/Tags; switch to server-side pagination/filtering.
- Introduce list virtualization for large grids (only if needed after measuring).

### 6) Performance monitoring tools
- Add a lightweight request timing collector (p50/p95, by route/status) exposed via authenticated admin endpoint.
- Reuse existing cache stats UI ([AdminCacheSettings.tsx](file:///Users/magnetoid/nisam-video/nisam-video/client/src/pages/AdminCacheSettings.tsx)) and extend with:
  - Recent slow endpoints, scrape durations, cache hit rates by route.

## Verification
- Add a reproducible test path:
  - Trigger scrape, confirm DB insert count increases.
  - Confirm `X-Cache` transitions to MISS after ingest (no stale `/api/videos*`).
  - Confirm Home carousels and `/api/videos` show new items immediately.
  - Confirm admin SSE shows live progress/logs and persists logs in DB.
