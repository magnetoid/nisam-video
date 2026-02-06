# Netflix-Style Hero Slider — Page Design Spec (Desktop-first)

## Global Styles (Design Tokens)
- Background: #0B0B0B (app background), #000000 (hero overlay base)
- Text: primary #FFFFFF, secondary rgba(255,255,255,0.75)
- Accent: #E50914 (primary CTA/active indicator)
- Typography (desktop-first):
  - H1: 44–56px / 1.1 (hero title)
  - Body: 16–18px / 1.5
  - Caption: 12–14px / 1.4
- Buttons:
  - Primary: filled accent, white text; hover: slightly darker accent; focus: 2px outline (white or accent)
  - Secondary: translucent dark background with white text; hover: increase opacity
- Links: underline on hover; focus-visible outline

## Page: Home

### Meta Information
- Title: Home
- Description: Browse featured content with a hero carousel.
- Open Graph: title/description consistent; hero image used as OG image when available.

### Layout
- Primary layout: stacked sections (vertical flow). Hero at top, full-bleed.
- CSS approach: hybrid (CSS Grid for hero overlay layout + Flexbox for controls alignment).
- Spacing system: 8px base; hero padding 24px (desktop), 16px (tablet), 12px (mobile).

### Page Structure
1. Hero slider (full-bleed)
2. (Down-page content not specified; keep scope to hero slider)

### Sections & Components

#### 1) Hero Slider Region (Carousel)
- Container
  - Full width; height: 520–640px desktop, 420–520px tablet, 280–360px mobile.
  - Background image per active slide (cover, center).
  - Gradient overlay to ensure text contrast (e.g., left-to-right + bottom fade).
- Accessibility container semantics
  - Root element: role="region", aria-roledescription="carousel", aria-label="Featured titles"
  - Optional instruction text for screen readers (visually hidden): e.g., “Use next and previous buttons to navigate.”

#### 2) Slide Content Overlay
- Layout
  - Grid: two columns on desktop (left text block / right empty or image emphasis), single column on mobile.
  - Text block max-width: 560–680px.
- Elements (per slide)
  - Title (H1)
  - Short description (1–3 lines, clamp with ellipsis)
  - Optional metadata row (e.g., tags) only if present in slide data
- States
  - Only active slide content is focusable; inactive slide panels are aria-hidden="true".

#### 3) Manual Controls
- Prev/Next buttons
  - Positioned vertically centered at left/right edges inside hero.
  - Large hit area (min 44x44px).
  - ARIA: aria-label="Previous slide" / aria-label="Next slide".
- Slide indicators (dots)
  - Row at bottom-left (or bottom-center on mobile).
  - 5–12px dots; active dot uses accent color.
  - Each dot is a button with aria-label="Go to slide N"; active dot uses aria-current="true".
- Keyboard behavior
  - Tab reaches controls in logical order: prev → next → dots (or prev → dots → next).
  - Enter/Space activates focused control.
  - Visible focus ring on all interactive elements (focus-visible).

#### 4) Autoplay Behavior (every 5s)
- Timing
  - Auto-advance at a 5000ms interval.
- Interaction rule
  - Manual navigation immediately updates the active slide and restarts the 5s interval.

#### 5) Lazy-loading & Performance
- Image loading
  - Active slide image loads with high priority (eager).
  - Non-active slide images load lazily (e.g., loading="lazy" when rendered).
- Rendering strategy
  - Render only the active slide plus adjacent slides if needed for smooth transitions; ensure this does not break accessibility (only active is exposed to AT).

#### 6) Responsive Behavior
- Desktop (≥1024px)
  - Full hero height; text overlay left; controls at edges.
- Tablet (600–1023px)
  - Slightly reduced hero height; indicators move inward; typography scales down.
- Mobile (<600px)
  - Hero height reduced; title clamps more aggressively; controls remain reachable without overlapping text.

#### 7) Motion & Transitions
- Slide transition
  - Crossfade or translate with 250–450ms ease-out.
  - Respect reduced motion: if prefers-reduced-motion enabled, minimize/disable animation and