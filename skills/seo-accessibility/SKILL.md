---
title: SEO Accessibility
description: ARIA roles, skip navigation, focus management, and accessibility practices that directly impact SEO.
version: 1.0.0
---

# SEO: Accessibility

## When to use
Use this skill when:
- Building navigation, forms, modals, or interactive components.
- Implementing skip navigation or focus management.
- Adding ARIA attributes to dynamic content.
- Ensuring screen reader compatibility (which also benefits search engine comprehension).

## Inputs required
- The type of interactive component being built (nav, modal, tabs, accordion, etc.).
- Whether the page has dynamic content updates (SPAs, AJAX loading).
- Target WCAG compliance level (typically 2.1 AA).

## Procedure

### 1. ARIA Landmark Roles
- Use semantic HTML landmarks first (`<nav>`, `<main>`, `<aside>`, etc.).
- Only add ARIA roles when semantic HTML isn't sufficient.

```html
<!-- ✅ Semantic HTML (preferred) -->
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>

<main>
  <article>Content...</article>
</main>

<!-- Add ARIA only when needed -->
<div role="search">
  <form>
    <label for="search-input">Search</label>
    <input type="search" id="search-input" name="q" />
  </form>
</div>
```

### 2. Skip Navigation
- Every page MUST have a skip-to-content link as the first focusable element.
- This helps screen readers AND improves crawlability by defining the main content area.

```html
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <header>...</header>
  <nav>...</nav>
  <main id="main-content">
    <!-- Main content -->
  </main>
</body>
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  padding: 8px 16px;
  background: #000;
  color: #fff;
  z-index: 100;
  transition: top 0.2s;
}

.skip-link:focus {
  top: 0;
}
```

### 3. Focus Management in SPAs
- After client-side navigation, move focus to the new page's `<h1>` or main content area.
- Announce route changes to screen readers.

```jsx
// React Router example
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function RouteAnnouncer() {
  const location = useLocation();

  useEffect(() => {
    const heading = document.querySelector('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }
  }, [location.pathname]);

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      Navigated to {document.title}
    </div>
  );
}
```

### 4. Images and Media Accessibility
- All images must have `alt` attributes (empty `alt=""` for purely decorative images).
- Videos should have captions or transcripts.
- Use `aria-describedby` for complex images like charts.

```html
<!-- Informative image -->
<img src="/chart.png" alt="Sales grew 45% in Q3 2025" />

<!-- Decorative image -->
<img src="/divider.svg" alt="" role="presentation" />

<!-- Complex image -->
<figure>
  <img src="/infographic.png" alt="SEO audit process" aria-describedby="infographic-desc" />
  <figcaption id="infographic-desc">
    Step-by-step SEO audit process: crawl analysis, content audit, technical review, and action plan.
  </figcaption>
</figure>
```

## Verification
- **Lighthouse Accessibility audit:** Score ≥ 90.
- **Screen reader test:** Navigate with VoiceOver (Mac) or NVDA (Windows) to verify content order.
- **Keyboard navigation:** Tab through the entire page — every interactive element must be reachable.
- **axe DevTools:** Run the [axe browser extension](https://www.deque.com/axe/) for automated checks.

## Failure modes / debugging
| Problem | Cause | Fix |
|---|---|---|
| Screen readers skip main content | Missing skip-navigation link | Add `<a href="#main-content">` as first focusable element |
| Focus lost after SPA navigation | No focus management after route change | Move focus to `<h1>` or main content after navigation |
| ARIA overuse creates noise | ARIA roles duplicating semantic elements | Remove redundant ARIA; use semantic HTML instead |
| Decorative images read aloud | Missing `alt=""` on decorative images | Add empty `alt=""` and `role="presentation"` |

## Escalation
- If WCAG compliance requires significant UI redesign, consult an accessibility specialist.
- If third-party components (date pickers, carousels) lack accessibility, escalate to the component vendor or consider accessible alternatives.
