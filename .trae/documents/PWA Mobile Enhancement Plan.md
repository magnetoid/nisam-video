**Phase 1: Perf (Startup/Memory, 4h)**
- Lazy code-split Admin pages/components.
- Virtualize logs/tables (react-window).
- SW precache API/images (Workbox).

**Phase 2: UX/Accessibility (3h)**
- Dark mode system pref (next-themes prefers-color-scheme).
- WCAG audit/fix (ARIA labels, contrast Tailwind).

**Phase 3: Analytics/Tests (8h)**
- Sentry crashlytics (client/server).
- Vitest 80% (unit/UI for Home/Admin).

**Phase 4: Release/Build (2h)**
- Vite PWA plugin optimize.
- Lighthouse validate Android/iOS PWA guidelines.

**Verif**: Bundle <1MB, memory -20%, coverage 80%, Lighthouse 100 PWA.
