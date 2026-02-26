## 1. Product Overview
Unify the current “SEO Settings” and “SEO Enhanced” admin experiences into a single, reliable SEO admin page.
Fix the existing SEO admin breakages and add a dynamic sitemap section with manual generation actions.

## 2. Core Features

### 2.1 User Roles
| Role | Registration Method | Core Permissions |
|------|---------------------|------------------|
| Admin | Existing admin login | Can view and edit SEO configuration, manage SEO entities, and trigger sitemap actions |

### 2.2 Feature Module
Our admin SEO requirements consist of the following main pages:
1. **Admin Login**: authenticate admin access.
2. **Admin SEO (Unified)**: tabs for global SEO settings, advanced SEO settings, meta tags, redirects, keywords, audits, and sitemap/robots tools.

### 2.3 Page Details
| Page Name | Module Name | Feature description |
|---|---|---|
| Admin Login | Authentication | Sign in and create an authenticated session required for admin routes. |
| Admin SEO (Unified) | Navigation + IA | Show a single “SEO” item in the admin sidebar; remove/avoid duplicate “SEO Enhanced” entry; keep legacy route working via redirect to the unified page. |
| Admin SEO (Unified) | Data loading + stability (Bug Fix) | Fix API shape mismatches so lists render without runtime errors (server returns paginated objects; UI must read the correct keys). Ensure empty/loading/error states do not crash the page. |
| Admin SEO (Unified) | Global SEO Settings | View and edit: site name, site description, OG image URL, meta keywords; save changes; show a lightweight search/snippet preview. |
| Admin SEO (Unified) | Advanced SEO Settings | View and edit: schema/hreflang toggles, default language, local SEO fields, robots.txt content (edit + save); keep validation consistent with server constraints. |
| Admin SEO (Unified) | Meta Tags Management | List meta tags with pagination; filter/search; create/edit/delete; bulk update where supported; display SEO score per item when present. |
| Admin SEO (Unified) | Redirects Management | List redirects with pagination; filter/search; create/delete; show basic status fields (type, active, hits). |
| Admin SEO (Unified) | Keywords Management | List keywords with pagination; filter/search/sort; create/update/delete; show rank/volume/difficulty fields when present. |
| Admin SEO (Unified) | Audits | Start an audit (full site or by URL), list historical results with severity badges. |
| Admin SEO (Unified) | Sitemap (Dynamic) | Display sitemap URL(s) and live stats (e.g., URL count, last fetch time, fetch status). Provide manual actions: Open sitemap, Download XML, Regenerate (refetch). |

## 3. Core Process
**Admin Flow (SEO Management)**
1. You sign in on Admin Login.
2. You open Admin → SEO (single unified page).
3. You use tabs to update global/advanced settings and save.
4. You manage meta tags/redirects/keywords as needed.
5. You open the Sitemap section to view current sitemap stats and manually regenerate/download.

```mermaid
graph TD
  A["Admin Login"] --> B["Admin Dashboard"]
  B --> C["Admin SEO (Unified)"]
  C --> D["Global SEO Settings"]
  C --> E["Advanced SEO Settings"]
  C --> F["Meta Tags"]
  C --> G["Redirects"]
  C --> H["Keywords"]
  C --> I["Audits"]
  C --> J["S