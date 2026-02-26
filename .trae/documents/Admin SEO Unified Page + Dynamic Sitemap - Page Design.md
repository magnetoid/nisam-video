# Admin SEO (Unified) — Page Design Specification (Desktop-first)

## Layout
- Primary layout: fixed left admin sidebar + scrollable main content.
- Use a max-width container for readability (e.g., `max-w-7xl`) with consistent vertical spacing (`space-y-6`).
- Tabs are the primary IA mechanism; keep tab list sticky at top of content on scroll for long lists.

## Meta Information
- Title: `Admin • SEO`
- Description: `Manage global and advanced SEO settings, meta tags, redirects, keywords, audits, and sitemap tools.`
- Open Graph: `og:title = Admin • SEO`, `og:description = ...` (noindex the admin area via meta/robots policy).

## Global Styles
- Typography: use existing app scale; headings 32/24/18; body 14/16.
- Accent color: app primary; status colors: green (good), yellow (warning), red (error).
- Buttons: primary for “Save” and “Run”; outline for secondary actions; destructive for deletes.
- Tables: compact density by default; show empty state rows with clear guidance.

## Page Structure
1. Page header
2. Health/summary row (optional quick stats)
3. Tab navigation
4. Tab content panels

## Sections & Components

### 1) Header
- Left: page title “SEO” + short subtitle.
- Right: status badges (e.g., “Schema enabled”) based on settings.
- Include a small “Last saved” line when settings update succeeds.

### 2) Tabs (single unified page)
Tabs (recommended):
- Overview
- Global Settings
- Advanced Settings
- Meta Tags
- Redirects
- Keywords
- Audits
- Sitemap & Robots

Interaction rules:
- Persist active tab in URL query (e.g., `?tab=meta-tags`) so refresh/back works.
- Each tab has loading skeletons and non-blocking error banners.

### 3) Overview Tab
- Cards grid (2–4 columns on desktop): average SEO score, active redirects, tracked keywords, last audit status.
- Each card links to the relevant tab.

### 4) Global Settings Tab
- Form card with fields: site name, site description, OG image URL, meta keywords.
- Inline validation; helper text for recommended lengths.
- Right column (desktop): snippet preview (search result + social share preview) updating live from form state.

### 5) Advanced Settings Tab
- Form sections:
  - Toggles: schema markup, hreflang, auto sitemap submission (if supported).
  - Localization: default language.
  - Local SEO: business name/address/phone/email/hours, coordinates.
  - Robots.txt: editor textarea with monospace style, “Save” button.

### 6) Meta Tags Tab
- Toolbar: search input, page type filter, active filter, pagination controls.
- Table: URL, title, description, score badge, active toggle, actions (edit/delete).
- Drawer/modal editor for create/edit with live SEO score preview (if available).
- Bulk mode: checkbox selection + bulk update bar.

### 7) Redirects Tab
- Toolbar: search, type filter (301/302), active filter.
- Table: from → to, type, active, hits, actions.
- Create redirect modal: fromUrl/toUrl/type.

### 8) Keywords Tab
- Toolbar: search, competition filter, sort selector.
- Table: keyword, volume, difficulty, current rank, target rank, actions.

### 9) Audits Tab
- Run audit panel: URL input + “Run” button; include quick action “Run full audit”.
- Results list/table: date, page URL, score, issue counts by severity; click row to expand issues.

### 10) Sitemap & Robots Tab (Dynamic sitemap section)
Sitemap card:
- Display: canonical sitemap URL (e.g., `/sitemap.xml`) as a clickable link.
- Live stats (after fetch): last fetched timestamp, HTTP status, total `<url>` count.
- Manual actions:
  - “Open sitemap” (new tab)
  - “Download XML” (force file download)
  - “Regenerate” (refetch + refresh stats)

Robots card:
- Display current robots policy link (`/robots.txt`) and a text editor (if editable via API), otherwise read-only preview.

## Responsive behavior
- Desktop-first; below ~1024px, collapse stats grid to 2 columns.
- Tables become horizontally scrollable with sticky first column for URL fields.

## Interaction states
- Global: loading skeletons,