## Hero H1 Positioning
- Update [HeroImageSlider.tsx](file:///Users/magnetoid/nisam-video/nisam-video/client/src/components/HeroImageSlider.tsx) to shift the `<h1>` to the right by ~16px.
- Implementation: add a Tailwind transform class on the `<h1>` (e.g. `translate-x-4`) or a small `margin-left` (`ml-4`) so the title has consistent separation from the left navigation arrow.
- Keep the existing safe padding (`pl-16/pr-16` etc.) and only adjust the title element so the rest of the layout remains unchanged.
- Verify across breakpoints: mobile (320–390px), tablet (~768px), desktop (≥1024px) by checking long titles don’t collide with the left/right chevrons.

## Diagnose Why “Incremental Scraping” Fails
- The current cron scheduler in [scheduler.ts](file:///Users/magnetoid/nisam-video/nisam-video/server/scheduler.ts) always loops **all channels** (`storage.getAllChannels()`) and scrapes each one every run.
- The scheduler is **disabled in production/serverless** because [server/index.ts](file:///Users/magnetoid/nisam-video/nisam-video/server/index.ts#L287-L293) only calls `scheduler.init()` when `NODE_ENV !== "production"`.
- There is also no timestamp/cursor-based filtering inside the scrape loop; dedupe happens late in ingestion.

## Implement True Incremental, Progressive Scraping
- Change the scheduler’s channel selection from “all channels” to “channels needing scrape”:
  - Use the existing DB query in [channel-repository.ts](file:///Users/magnetoid/nisam-video/nisam-video/server/repositories/channel-repository.ts#L35-L48) (cutoff based on `lastScraped`) via `ChannelService.getChannelsNeedingScrape()`.
  - Use `intervalHours` (scheduler setting) to compute `maxAgeHours`.
- Add **batch limits per run** so a single run processes only a small subset (e.g. 5–20 channels) and leaves the rest for later runs.
  - Make it configurable (env var + default) so Vercel/serverless runs finish fast.
- Apply incremental optimization at the scraper layer:
  - For YouTube, pass `existingVideoIds` + `incremental` into `scrapeYouTubeChannel(...)` (the scheduler currently doesn’t).
  - Add an “early stop” rule in incremental mode: once we see N consecutive already-known video IDs, stop parsing further items (reduces repeated work while avoiding misses).
- Rate limiting + backoff:
  - Keep per-channel retries (`p-retry`) but add a small inter-channel delay and/or `p-limit` concurrency (1–2) to avoid bursts.
  - Increase delays when error rate spikes (adaptive slowdown).

## Progress Logging + Monitoring
- Persist job progress for each run:
  - Reuse the existing `scrape_jobs` table fields (`total_channels`, `processed_channels`, `current_channel_name`, `videos_added`, `error_message`, timestamps) and update them during the run.
- Add structured logs:
  - Log per-channel timings, fetched count, saved count, retries, and backoff decisions.
  - Emit a warning if a run starts processing a suspiciously high percentage of channels (indicating incremental selection regressed).
- Expose monitoring to the UI:
  - Add/extend an endpoint returning the current/last job state and error rate.
  - Show it in the Admin Automation dashboard (progress bar + counts + last run summary).

## Make It Work on Vercel/Production
- Since background cron isn’t started in production, add a production-friendly trigger:
  - Option A (recommended on Vercel): configure Vercel Cron to call `/api/scheduler/run-now` periodically.
  - Ensure `run-now` only processes one incremental batch and returns quickly.
  - Option B: move scraping to a separate always-on worker (non-serverless).

## Verification
- Hero title: manually verify at multiple viewport sizes with long and short titles.
- Scraping:
  - Run a manual scheduler run and verify it only processes the “needs scrape” batch.
  - Confirm `lastScraped` updates correctly and subsequent runs skip recently-scraped channels.
  - Verify logs show incremental behavior (new videos discovered decreases over time, stable runtime, controlled retries).

If you confirm, I’ll implement the code changes, add the monitoring endpoints, and validate the UI + scheduler behavior end-to-end.