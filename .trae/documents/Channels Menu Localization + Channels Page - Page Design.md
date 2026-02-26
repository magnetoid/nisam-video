# Page Design — Localized “Channels/Kanali” Menu + Netflix-Style Channels Directory

## Global Styles (applies to all pages)
- Layout system: Desktop-first, responsive down to tablet/mobile using a hybrid of CSS Grid (overall page structure) and Flexbox (nav + rails).
- Spacing: 8px base spacing scale (8/16/24/32/48).
- Typography: 
  - H1 32–40px, H2 24–28px, body 14–16px, caption 12–13px.
- Colors (Netflix-inspired, but brand-safe):
  - Background: near-black (#0b0b0f)
  - Surface: dark (#141418)
  - Text primary: white (#ffffff)
  - Text secondary: gray (#b3b3b3)
  - Accent: red (#e50914) for active states and key CTAs
- Buttons/links:
  - Primary button: accent background, white text; hover: slightly brighter; active: slight darken.
  - Link: white text; hover: underline + subtle color shift.
- Card interaction:
  - Hover/focus: scale 1.04–1.08, elevate shadow, show focus ring for keyboard navigation.
  - Transitions: 150–220ms ease-out for transform/opacity.

---

## Page: Home

### Layout
- Header (sticky): left = logo/home link, center/right = top menu items.
- Body: existing home layout; only new requirement is the localized menu entry.

### Meta Information
- Title: Localized, existing site title format (no change required beyond consistency).
- Description: unchanged.
- Open Graph: unchanged.

### Page Structure
1. Sticky top navigation
2. Existing home sections

### Sections & Components
**1) Top Navigation Bar (shared component)**
- Elements:
  - Logo / Home link.
  - Menu item: “Channels” (English) / “Kanali” (target locale).
- Behavior:
  - Menu label updates immediately when language changes.
  - Active state when user is on `/channels` (accent underline or accent text).
- Accessibility:
  - Menu item is keyboard focusable.
  - Visible focus ring on keyboard navigation.

---

## Page: Channels (Netflix-style directory)

### Layout
- Desktop-first container width: 1200–1440px max, centered; full-bleed background.
- Use stacked vertical sections with multiple horizontal “rails”.
- Each rail uses horizontal scroll (mouse wheel + trackpad) and/or arrow controls.

### Meta Information
- Title: `Channels` / `Kanali` (localized)
- Description: “Browse all channels.” (localized as available)
- Open Graph:
  - og:title mirrors title
  - og:description mirrors description

### Page Structure
1. Sticky top navigation (shared)
2. Page header (title + subtitle)
3. Rails container (one or many rows)
4. Footer (if already present globally)

### Sections & Components
**1) Page Header**
- Left-aligned title: “Channels/Kanali”.
- Subtitle: “Browse all channels” (localized if available).
- Optional right-aligned small hint: “Scroll to explore” (keep minimal).

**2) Channel Rails (Netflix-style rows)**
- Data-driven grouping:
  - If `category` is present: create one rail per category.
  - If not present: single rail named “All Channels”.
- Rail header:
  - Category name (localized only if you have translations; otherwise display as-is).
- Rail content:
  - Horizontal list of cards.
  - Provide left/right chevrons on desktop (visible on hover) to nudge-scroll one viewport width.
- Responsiveness:
  - Desktop: 6–8 cards visible per row (depending on card width).
  - Tablet: 3–5 cards visible.
  - Mobile: 2–3 cards visible with touch scrolling.

**3) Channel Card (clickable link)**
- Card size (desktop target): ~220–280px wide, 120–160px tall (16:9-ish).
- Contents:
  - Thumbnail/logo image area (cover fit).
  - Channel name (one line, ellipsis).
- Interaction:
  - Hover: scale up, reveal subtle overlay gradient, show channel name more prominently.
  - Focus: visible focus ring.
  - Click: navigate to Channel Watch page or open channel href (existing behavior).

**4) Empty/Error States**
- Empty: centered message “No channels available.” and a secondary explanation.
- Error: message “Couldn’t load channels.” plus “Retry” button (if applicable).

---

## Page: Channel Watch

### Layout
- Two-column desktop layout:
  - Main: player/content area.
  - Side: channel info and actions (compact).
- Tablet/mobile: single column stacked.

### Meta Information
- Title: `{Channel Name} — Channels` (localized suffix optional)
- Description: “Watch {Channel Name}.”
- Open Graph:
  - og:title same as title
  - og:image uses channel thumbnail/logo if available

### Page Structure
1. Sticky top navigation (shared)
2. Breadcrumb/back row
3. Player/open-link area
4. Channel details panel

### Sections & Components
**1) Back to Channels**
- Prominent text button: “← Back to Channels” (localized if available).
- Always visible above the player.

**2) Playback / Destination Area**
- If the product already uses an embedded player: show it in a 16:9 responsive container.
- If the product uses external channel links: provide a primary action “Open channel” that navigates to `href`.

**3) Channel Context**
- Show channel name, optional logo