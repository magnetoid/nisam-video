## 1. Context
This project is a React + Tailwind CSS UI with Radix/shadcn components and client-side routing (wouter). Responsiveness work should be implemented primarily via shared layout components and shared UI primitives, then refined on high-density pages (admin tables, dashboards, editors).

## 2. Breakpoints and layout rules
- Breakpoints (Tailwind defaults):
  - Mobile: `<640px`
  - Tablet: `640–1023px` (`sm` + `md`)
  - Desktop: `>=1024px` (`lg`)
- Container strategy:
  - Use consistent horizontal padding: `px-4` on mobile, `sm:px-6` on tablet, `lg:px-8+` on desktop.
  - Avoid fixed widths; prefer `max-w-*` + `w-full` + `min-w-0`.
- Overflow strategy:
  - Prevent page-level horizontal overflow.
  - Wrap tables and wide lists in `overflow-x-auto` containers.
  - Use `break-words` / `overflow-hidden` / `truncate` on long URLs/IDs.

## 3. Navigation architecture
### 3.1 Public navigation
- Desktop/tablet: top header with inline nav links.
- Mobile: hamburger opens a left-side sheet/drawer.
- Close drawer on navigation.
- Preserve focus trap and escape-to-close (Radix sheet provides this).

### 3.2 Admin navigation
- Desktop/tablet: sidebar persistent.
- Mobile: sidebar becomes a slide-in drawer with an overlay.
- Header menu button toggles sidebar on mobile.

## 4. Touch usability requirements (implementation)
- Tap target minimum: `44px` height/width for interactive controls on mobile.
- Prefer responsive sizing on shared primitives:
  - Buttons: `h-11` on mobile, revert to smaller sizes on tablet/desktop as needed.
  - Inputs/select triggers: `h-11` on mobile.
- Avoid hover-only UI:
  - Provide visible buttons/menus without requiring hover.
  - Ensure `:focus-visible` styles remain clear.
- Safe areas (iOS):
  - Add bottom padding for drawers/sheets: `pb-[env(safe-area-inset-bottom)]`.

## 5. Data-dense UIs (admin)
### 5.1 Tables
- Default behavior: wrap in horizontal scroll.
- Reduce padding on mobile to fit more columns.
- For extreme density: provide a card/list alternative at narrow widths for key tables.

### 5.2 Forms
- Use stacked layout by default; use `md:grid-cols-2` only for tablet+.
- Ensure form actions remain reachable without precision taps.
- Avoid multi-pane layouts on mobile (collapse panels into tabs/accordion).

## 6. QA checklist
- Screen sizes:
  - 375×667 (iPhone)
  - 390×844 (modern iPhone)
  - 412×915 (Android)
  - iPad 768×1024 portrait and 1024×768 landscape
- Flows:
  - Public nav open/close, route change closes drawer
  - Admin nav open/close on mobile, content scrolls independently
  - Table scroll does not cause whole-page horizontal scrolling
  - Forms usable without zoom; errors visible

