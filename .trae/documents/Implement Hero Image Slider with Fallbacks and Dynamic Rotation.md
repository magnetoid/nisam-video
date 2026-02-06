## Overview
Extend the existing video-based hero system to support a dynamic image slider with random rotation of 5 images, configurable fallbacks, smooth animations, and full a11y/degradation support. Preserve video compatibility via a settings toggle. Total effort: ~4-6 hours, focusing on schema/backend first, then frontend.

## Step 1: Database Schema Updates (shared/schema.ts)
- Add `heroImages` table: pgTable with id (uuid), url (text notNull), alt (text), aspectRatio (varchar default "16:9"), isActive (boolean default true), createdAt/updatedAt.
- Add `heroSettings` table: pgTable with id (uuid primaryKey), fallbackImages (json[] default []), rotationInterval (integer default 4000, 3000-5000ms), animationType (varchar enum ["fade", "slide"] default "fade"), defaultPlaceholderUrl (text), enableRandom (boolean default true), enableImages (boolean default true, to toggle vs videos), updatedAt.
- Export types: `HeroImage`, `HeroSettings`, Zod schemas (insertHeroImageSchema, updateHeroSettingsSchema), and joined type `RandomHeroImages` (array of 5 with settings).
- Run migration: Use Drizzle's migrate command (if scripted) or manual SQL via Supabase dashboard to create tables.

## Step 2: Backend Extensions (server/routes/admin.ts, server/storage/database.ts)
- In storage/database.ts: Add `getHeroSettings()` (select single row or default {}), `updateHeroSettings(settings: UpdateHeroSettings)`, `getHeroImages()` (select active), `upsertHeroImage(image: InsertHeroImage)` (insert or update by id), `getRandomHeroImages()` (query active images ORDER BY RANDOM() LIMIT 5, pad with fallbackImages from settings if <5, return with settings).
- Validate images: Helper `validateImageUrl(url: string)` (fetch head, check content-type image/* and 200 OK, timeout 5s).
- In routes/admin.ts: Add GET/POST `/hero/config` (fetch/update settings, Zod parse), GET/POST `/hero/images` (list/upsert images, auth required, validate URLs on POST).
- New public route: GET `/hero/random` (no auth, call getRandomHeroImages, cache 30s with short TTL for freshness, CORS for frontend).
- Invalidate cache on updates (extend existing hero:videos:admin to hero:images:admin).

## Step 3: Admin UI Updates (client/src/pages/AdminHeroManagement.tsx)
- Add Tabs from shadcn (existing import): New tab "Hero Images" with drag-drop list (reuse Droppable/DroppableItem pattern for reordering by adding displayOrder field to heroImages).
- Image upload: Button to select files (use FileReader or direct to /api/admin/hero/images POST with FormData, handle progress via useState).
- Config section in a new tab "Slider Settings": Form with react-hook-form (zodResolver), fields for interval (Slider 3-5s), animation (Select), fallbackImages (multi-input array), placeholder URL (Input), enableRandom/toggle (Switch). Submit mutates /hero/config.
- Preview: Embed a mini HeroImageSlider (pass mock random data) below config for live testing.
- Extend existing video tab with toggle to disable images if needed.

## Step 4: Frontend Slider Implementation (client/src/pages/Home.tsx)
- Create reusable `HeroImageSlider.tsx` component (new file in components/): Props { images: HeroImage[], settings: HeroSettings }.
- Fetch: useQuery(['hero/random'], () => apiRequest('GET', '/api/hero/random').then(res => res.json())).
- Structure: Container with aspect-[16/9] w-full relative overflow-hidden.
- Slides: Use Embla Carousel base, but wrap each <CarouselItem> in framer-motion <motion.div> (AnimatePresence for exit animations: opacity/scale for fade, x for slide).
- Auto-rotation: useEffect with setInterval (clear on unmount), pause on mouseEnter/mouseLeave (useState isPaused).
- Nav: Reuse <CarouselPrevious>/<CarouselNext> (Embla), add dots (array.map index, active via Embla API).
- Image: <img src={url} alt={alt} loading="lazy" onError={(e) => (e.target as HTMLImageElement).src = settings.defaultPlaceholderUrl} className="object-cover w-full h-full" style={{aspectRatio}} />.
- Loading: Skeleton (shimmer div) while isLoading, or per-image placeholder.
- A11y: role="img" aria-label="Hero image {index+1} of {length}", keyboard: useEffect addEventListener('keydown', arrows to embla.scrollPrev/Next), focusable buttons.
- Noscript: <noscript><div className="grid grid-cols-1 md:grid-cols-5 gap-4">{images.map(img => <img key={id} src={url} alt={alt} className="w-full aspect-[16/9] object-cover" />)}</div></noscript>.
- Responsive: Tailwind media queries for mobile (fewer images? or same with smaller nav).
- Integrate: In Home.tsx, replace existing hero Carousel with <HeroImageSlider data={query.data} />, conditional on settings.enableImages (else fallback to video carousel).

## Step 5: Error Handling, Optimizations, and Testing
- Errors: Global onError for images -> toast notification (if admin), fallback src; API errors -> static default image.
- Opts: Lazy load beyond first 2, IntersectionObserver for offscreen; maintain aspect via CSS preserveAspectRatio.
- Testing: npm run dev (check slider rotation/randomness), npm run build/lint/typecheck (0 errors), manual: Hover pause, keyboard nav, screen reader (NVDA/VoiceOver announce slides), no-JS (disable JS, verify grid), error sim (bad URL -> placeholder), mobile responsive.
- Edge cases: 0 images -> all fallbacks; JS off -> stacked grid; slow network -> loading states.
- Deployment: After changes, npm run build, redeploy to Vercel, test /hero/random endpoint.

This plan ensures minimal disruption (video hero remains functional) and follows project patterns for scalability.