## 1. Design goals
- Make every page usable and readable on mobile and tablet.
- Keep primary actions reachable and visually obvious.
- Avoid horizontal overflow and “tiny tap targets”.

## 2. Global layout spec
### 2.1 Header
- Height: `64px` fixed.
- Mobile:
  - Left: hamburger (44×44).
  - Center/left: brand.
  - Right: search + theme + user.
  - Nav links move into drawer.
- Tablet/Desktop:
  - Inline nav links shown.
  - Increased side padding.

### 2.2 Footer
- Mobile:
  - Stack links; avoid tiny links; keep line-height comfortable.
- Tablet/Desktop:
  - Use multi-column layout.

### 2.3 Page paddings
- Default page padding: `px-4` mobile, `sm:px-6`, `lg:px-8`.
- Ensure page content starts below header: `pt-16` (or larger where hero sections require it).

## 3. Public pages
### 3.1 Home
- Hero:
  - Ensure title/metadata wraps and stays readable on 320–430px widths.
  - Keep primary CTA button full-width on very small screens (optional), or at least 44px height.
- Carousels:
  - Maintain swipe/scroll usability.
  - Avoid “hover-only” controls; show arrows only on non-touch or keep them large.

### 3.2 Listing pages (Channels/Categories/Tags/Popular/Shorts)
- Mobile:
  - Prefer 1-column cards or 2-column grid depending on content density.
  - Filters/search should be placed above list and collapse into a sheet if needed.
- Tablet:
  - Use 2–3 columns.

### 3.3 Detail pages (Video/Channel/Category/Tag)
- Mobile:
  - Stack sections vertically.
  - Ensure long titles/URLs wrap or clamp.
  - Keep action buttons 44px min height.
- Tablet:
  - Allow two-column only when both columns remain readable.

## 4. Admin pages
### 4.1 Admin shell
- Mobile:
  - Sidebar becomes drawer.
  - Overlay dismiss.
  - Main content scroll independent.
- Tablet/Desktop:
  - Sidebar persistent.

### 4.2 Admin list pages (Videos/Channels/Categories/Tags/Users/Logs)
- Table default:
  - Wrap in horizontal scroll.
  - Reduce cell padding on mobile.
  - Hide nonessential columns at small widths if needed.
- Actions:
  - Avoid tiny icon-only buttons; ensure 44px tap targets.

### 4.3 Admin forms (Settings/SEO/Hero/Automation)
- Mobile:
  - Use single column.
  - Save buttons pinned at bottom of section or placed immediately after the form.
  - Use select and inputs with 44px height.
- Tablet:
  - Allow two-column grouping where it improves scanning.

## 5. Accessibility and interaction
- Keyboard:
  - All drawers/dialogs must trap focus and close on Escape.
  - Visible focus rings.
- Touch:
  - 44px minimum targets.
  - Don’t rely on hover for discovery.

