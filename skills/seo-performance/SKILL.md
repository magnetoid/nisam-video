---
title: SEO Performance & Core Web Vitals
description: Rules for optimizing Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS), and Interaction to Next Paint (INP).
version: 1.0.0
---

# SEO: Performance & Core Web Vitals

## When to use
Use this skill when:
- Building or optimizing pages for Google's Core Web Vitals ranking signals.
- Debugging slow page loads, layout shifts, or sluggish interactions.
- Adding fonts, images, scripts, or third-party resources.
- Implementing critical CSS, code splitting, or lazy loading strategies.

## Inputs required
- Current Lighthouse or PageSpeed Insights scores (if available).
- The framework and rendering strategy (SSR, SSG, CSR).
- Key resources on the page (fonts, hero images, third-party scripts).

## Procedure

### 1. Largest Contentful Paint (LCP) — Target: ≤ 2.5s
- Preload the LCP element (usually the hero image or main heading).
- Use `fetchpriority="high"` on the LCP image.
- Serve images in modern formats (WebP, AVIF).
- Inline critical CSS or use `<link rel="preload">` for key stylesheets.

```html
<!-- Preload hero image -->
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high" />

<!-- LCP image -->
<img src="/hero.webp" alt="Hero description"
     width="1200" height="630" fetchpriority="high" />
```

### 2. Cumulative Layout Shift (CLS) — Target: ≤ 0.1
- Always set explicit `width` and `height` on images and videos.
- Reserve space for ads, embeds, and dynamically loaded content.
- Use `font-display: swap` or `font-display: optional` to prevent layout shifts from font loading.

```html
<!-- Prevent layout shift with explicit dimensions -->
<img src="/photo.webp" alt="Description" width="800" height="450" loading="lazy" />

<!-- Reserve space for an ad slot -->
<div style="min-height: 250px;">
  <!-- Ad loads here -->
</div>
```

```css
/* Prevent font-swap layout shift */
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: swap;
}
```

### 3. Interaction to Next Paint (INP) — Target: ≤ 200ms
- Avoid long-running JavaScript tasks on the main thread.
- Use `requestIdleCallback` or `setTimeout` to defer non-critical work.
- Minimize third-party script impact with `async` or `defer`.

```html
<!-- Defer non-critical scripts -->
<script src="/analytics.js" defer></script>

<!-- Async for independent scripts -->
<script src="/chat-widget.js" async></script>
```

### 4. Font Loading
- Self-host fonts when possible.
- Preload critical font files.
- Use `font-display: swap` to avoid invisible text.

```html
<link rel="preload" as="font" type="font/woff2"
      href="/fonts/inter-var.woff2" crossorigin />
```

### 5. Resource Hints
- Use `<link rel="preconnect">` for third-party origins.
- Use `<link rel="dns-prefetch">` as a fallback.

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://cdn.example.com" crossorigin />
<link rel="dns-prefetch" href="https://analytics.example.com" />
```

## Verification
- **Lighthouse audit:** Run Lighthouse in Chrome DevTools → Performance score ≥ 90.
- **PageSpeed Insights:** Test live URL at [pagespeed.web.dev](https://pagespeed.web.dev/).
- **Web Vitals extension:** Install the [Web Vitals Chrome extension](https://chrome.google.com/webstore/detail/web-vitals/) for real-time monitoring.
- **CrUX dashboard:** Check field data in [Chrome UX Report](https://developer.chrome.com/docs/crux/).

## Failure modes / debugging
| Problem | Cause | Fix |
|---|---|---|
| LCP > 2.5s | Hero image not preloaded, large unoptimized images | Add `fetchpriority="high"`, convert to WebP/AVIF, preload LCP resource |
| CLS > 0.1 | Images without dimensions, late-loading ads or fonts | Set `width`/`height` on all media, reserve space for dynamic content |
| INP > 200ms | Long JavaScript tasks blocking main thread | Split tasks with `requestIdleCallback`, defer non-critical scripts |
| FOIT (Flash of Invisible Text) | Font loading blocks text render | Use `font-display: swap` and preload font files |

## Escalation
- If Core Web Vitals require infrastructure changes (CDN configuration, server response times), consult a DevOps or platform engineer.
- If third-party scripts (ads, analytics) are the primary bottleneck, escalate to the vendor or ad ops team.
