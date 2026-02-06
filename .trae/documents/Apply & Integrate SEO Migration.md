**Phase 1: DB Apply (Immediate)**
- RunCommand: `npx drizzle-kit push:pg` (blocking=true).

**Phase 2: Schema/Storage (1h)**
- schema.ts: Add seoMetaTagsRelations, insertSeoMetaTagSchema.
- database.ts: getSeoMetaTags({pageUrl?}), upsertSeoMetaTag(data), deleteSeoMetaTag(id).

**Phase 3: Routes/UI (30m)**
- seo.ts: Use storage, ?page/limit/filter=pageType, seoScore calc.
- SEO.tsx: Dynamic fetch/apply meta.

**Phase 4: Verif (15m)**
- npm run check; curl /api/seo/meta-tags; browser inspect meta tags.

Ensures dynamic SEO works. No downtime.
