## 1. Product Overview
Make all public and admin pages fully usable on mobile and tablet without sacrificing desktop UX.
Focus on responsive layout rules, navigation patterns, and touch-friendly interactions.

## 2. Core Features

### 2.1 Feature Module
Our responsiveness requirements consist of the following main pages:
1. **Public site pages**: responsive header/footer, content grids/lists, media players, filters.
2. **Admin console pages**: responsive admin layout (sidebar/topbar), data tables, forms, dashboards.
3. **Authentication pages**: login/register forms, validation UI, safe redirects.

### 2.3 Page Details
| Page Name | Module Name | Feature description |
|-----------|-------------|---------------------|
| Public site pages | Responsive layout system | Use consistent breakpoints for spacing/typography and switch from multi-column to single-column layouts on small screens. |
| Public site pages | Mobile navigation | Provide hamburger/drawer navigation and keep primary actions reachable with one thumb (sticky header as needed). |
| Public site pages | Touch & media usability | Ensure tap targets are at least 44×44px, avoid hover-only actions, make video/player controls reachable and not clipped. |
| Public site pages | Content density controls | Reduce visual noise on mobile (collapse secondary metadata, use line-clamp, progressive disclosure). |
| Admin console pages | Responsive admin shell | Convert left sidebar to collapsible drawer on mobile; keep topbar actions accessible; preserve breadcrumbs/page title. |
| Admin console pages | Tables & dashboards | Provide horizontal scroll with sticky first column OR switch to card/list view for narrow screens; keep sorting/filtering usable. |
| Admin console pages | Forms & editors | Use stacked form layout on mobile, larger inputs, clear error messaging, and avoid multi-pane editors below tablet widths. |
| Admin console pages | Touch-safe actions | Prevent destructive actions from being adjacent to common actions; add confirmation patterns that work well on touch. |
| Authentication pages | Responsive auth layout | Centered card on desktop; full-width, edge-to-edge friendly layout on mobile with safe-area padding. |
| Authentication pages | Keyboard & validation UX | Support mobile keyboards (input types), keep submit visible, and ensure errors are readable without zooming. |

## 3. Core Process
**Public user flow (mobile/tablet):** Open the site → use mobile header menu to navigate → browse lists/grids that adapt to screen size → open a detail/video page → interact with controls via large, touch-friendly buttons.

**Admin flow (mobile/tablet):** Open an admin page → open the admin drawer navigation → land on