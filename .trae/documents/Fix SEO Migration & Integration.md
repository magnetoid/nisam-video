
## Phase 1: Apply & Sync Migration (1h)
- Run `npx drizzle-kit push:pg`.
- Add schema relations/insert schemas.

## Phase 2: Storage & Routes (2h)
- database.ts: getSeoMetaTags(pageUrl?), upsertSeoMetaTag, deleteSeoMetaTag.
- seo.ts: Typed queries, pagination (?page/limit), seoScore calc (title len + OG).

## Phase 3: Dynamic Integration (1h)
- SEO.tsx: Fetch/apply from seoMetaTags.
- Pages (Home/Video): Override static meta.

## Phase 4: Verif (30m)
- npm run check; curl tests; browser inspect meta.

No risks; preserves functionality.
