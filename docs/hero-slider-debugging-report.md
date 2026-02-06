# Hero Slider Debugging Report

## Scope

This report covers three issues:

1. Hero images not displaying
2. Admin save failures
3. Automatic random video display in the hero area

## Issue 1: Hero Images Not Displaying

### Symptoms

- Homepage hero section shows an error state or an empty area.
- Network requests to `/api/hero/random` can fail when hero images/settings are not configured.

### Root Causes

1. **API behavior on fresh deployments**
   - `/api/hero/random` previously returned `404` with `{ "error": "No hero images configured" }`.
   - The frontend treated non-2xx as a hard failure and displayed a generic error state.

2. **Slider implementation flaws**
   - The previous slider version tracked `emblaApi`, but Embla was not initialized, so rotation/navigation logic could not work.
   - Animation variants were configured in a way that could keep slides invisible.

3. **Fallback list mutation (indirect display impact)**
   - `getRandomHeroImages()` mutated `settings.fallbackImages` via `shift()`, which could cause fallbacks to “disappear” after the first request when settings were cached.

### Fixes Implemented

- `/api/hero/random` now returns `200` with a stable `{ images: [], settings: ... }` payload when no hero configuration exists.
- Rewrote the slider rendering to a simpler, reliable approach:
  - Single active slide rendered at a time.
  - Timer-based rotation using `setInterval`.
  - Keyboard navigation (`ArrowLeft`, `ArrowRight`, `Space` pause/resume).
  - Image preloading for the next slide.
- Fixed fallback list mutation by copying the fallback array before shifting.

### Relevant Artifacts

- Public hero routes: `server/routes/public.ts`
- Slider component: `client/src/components/HeroImageSlider.tsx`
- Fallback selection: `server/storage/database.ts`

## Issue 2: Save Functionality Failure

### Symptoms

- Admin shows:
  - `Admin failed to load: insertHeroSettingsSchema is not defined`
- Or “Action Failed” with server `500` and body:
  - `{ "error": "insertHeroSettingsSchema is not defined" }`

### Root Causes

1. **Frontend crash**
   - `AdminHeroManagement` referenced `insertHeroSettingsSchema` without importing it.

2. **Backend crash**
   - `server/routes/admin.ts` referenced `insertHeroSettingsSchema` but did not import it.

3. **Image URL validation being too strict**
   - The image upsert path performed a `HEAD` request for validation and threw when it failed.
   - Many CDNs/origins block `HEAD` or return non-diagnostic responses, causing saves to fail.

### Fixes Implemented

- Added missing `insertHeroSettingsSchema` import to:
  - `client/src/pages/AdminHeroManagement.tsx`
  - `server/routes/admin.ts`
- Improved hero image validation behavior:
  - Try `HEAD` first.
  - If blocked (e.g., `403/405/415`), try a `GET` with `Range: bytes=0-0`.
  - If validation cannot be conclusively performed due to network/CDN behavior, save is allowed and the UI will fall back at render time.
  - Removed hard-throw on validation failure for hero images.

## Issue 3: Automatic Random Video Display Feature

### Goal

- When hero images are not configured, the hero area should still display engaging content.
- The system should automatically show a random video with proper embed source handling and caching.

### Implementation

- Added a public endpoint:
  - `GET /api/hero/random-video`
  - Picks a random item from `storage.getRecentVideos(50, lang)`.
  - Builds `embedUrl` using:
    - YouTube: `https://www.youtube.com/embed/{videoId}`
    - TikTok: `video.embedUrl || https://www.tiktok.com/embed/v2/{videoId}`
  - Caches the payload for 30s via the server in-memory cache.

- Updated `HeroImageSlider` behavior:
  - If `images.length === 0`, it attempts to render the random video iframe.
  - If no random video is available, it falls back to `defaultPlaceholderUrl` (if configured) and an informative empty-state message.

## Error Logs Captured

- `404: {"error":"No hero images configured"}` on `/api/hero/random`.
- `500: {"error":"insertHeroSettingsSchema is not defined"}` during admin saves.
- Client-side generic 404 UI: “404 Page Not Found. Did you forget to add the page to the router?”

## Tests Added

- Added API tests to ensure:
  - `GET /api/hero/random` returns `200` with a stable payload.
  - `GET /api/hero/random-video` returns `200` with the expected shape.

## Cross-Browser Compatibility Notes

- Slider logic uses standard DOM APIs (`setInterval`, `Image` preload, `<img>`, `<iframe>`).
- Uses `decoding="async"` to reduce main-thread decoding impact on supported browsers.
- Uses `referrerPolicy="strict-origin-when-cross-origin"` for the iframe to avoid cross-origin referrer leakage.

## Performance Metrics (Before vs After)

- DOM work:
  - Before: rendered N overlay slides at once.
  - After: renders 1 active slide at a time.

- Network:
  - Before: repeated failures on missing hero config could cause retries/errors.
  - After: stable `200` payload for missing config; random video payload cached for 30 seconds.

## Remaining Work (Optional)

- Expose a dedicated toggle in `heroSettings` for enabling/disabling random video mode.
- Add client-side component tests (React testing library) if the project adds a browser/jsdom test environment.
