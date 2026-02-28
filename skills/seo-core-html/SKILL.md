---
title: SEO Core HTML & Architecture Standards
description: Rules for enforcing strict semantic HTML, crawlable navigation, correct heading integrity, and optimized media tags.
version: 1.0.0
---

# SEO: Core HTML & Architecture Standards

## When to use
Use this skill when:
- Creating or refactoring HTML templates, React/Vue/Svelte components, or server-rendered views.
- Implementing navigation menus or internal linking.
- Structuring page content (headers, footers, sidebars, main content areas).
- Adding or modifying images, videos, and other media elements.

## Inputs required
- The framework in use (plain HTML, React, Next.js, Nuxt, Astro, etc.).
- Whether the page is server-rendered (SSR/SSG) or client-side only (CSR).
- The target page type (landing page, blog post, product page, etc.).

## Procedure

### 1. Strict Semantic HTML
- Use `<article>`, `<section>`, `<nav>`, `<main>`, `<header>`, `<footer>`, and `<aside>`.
- Never use generic `<div>` wrappers for meaningful content blocks.
- Search engines rely on these landmarks to understand page topography.

```html
<!-- ✅ CORRECT -->
<main>
  <article>
    <header><h1>Page Title</h1></header>
    <section>
      <h2>Section Heading</h2>
      <p>Content...</p>
    </section>
  </article>
  <aside>Sidebar content</aside>
</main>

<!-- ❌ WRONG -->
<div class="main">
  <div class="article">
    <div class="title">Page Title</div>
    <div class="section">Content...</div>
  </div>
</div>
```

### 2. Crawlable Navigation
- All links MUST be standard `<a>` tags with resolvable `href` attributes.
- Do not use JavaScript-only routing (e.g., `onClick={navigate}`) for internal links.
- In SPA frameworks (React Router, Vue Router), use the framework's link component which renders as an `<a>` tag.

```jsx
// ✅ CORRECT — React Router
<Link to="/about">About Us</Link>

// ✅ CORRECT — Plain HTML
<a href="/about">About Us</a>

// ❌ WRONG — Not crawlable
<button onClick={() => navigate('/about')}>About Us</button>
<div onClick={() => router.push('/about')}>About Us</div>
```

### 3. Heading Integrity
- Enforce a strict `H1 → H2 → H3` hierarchy. Never skip levels.
- Every page must have exactly **one** `<h1>`.
- Never use heading tags for styling purposes; use CSS instead.

```html
<!-- ✅ CORRECT -->
<h1>Main Page Title</h1>
  <h2>Section One</h2>
    <h3>Sub-section Detail</h3>
  <h2>Section Two</h2>

<!-- ❌ WRONG — Skips h2, has two h1 tags -->
<h1>Title</h1>
<h1>Another Title</h1>
  <h3>Jumped from h1 to h3</h3>
```

### 4. Media SEO
- Every `<img>` tag must have descriptive `alt` text.
- Use `loading="lazy"` for below-the-fold images.
- Use `fetchpriority="high"` for the primary above-the-fold image (LCP candidate).
- Specify `width` and `height` attributes to prevent layout shifts (CLS).

```html
<!-- Hero image (above the fold) -->
<img src="/hero.webp" alt="Team collaborating in modern office"
     width="1200" height="630" fetchpriority="high" />

<!-- Below-the-fold image -->
<img src="/feature.webp" alt="Dashboard analytics overview"
     width="800" height="450" loading="lazy" />
```

### 5. Snippet Control with `data-nosnippet`
- Use the `data-nosnippet` HTML attribute to exclude specific text from appearing in Google search snippets.
- Apply it to `<span>`, `<div>`, or `<section>` elements.

```html
<p>This text can appear in Google search snippets.</p>
<p data-nosnippet>This text will NOT appear in snippets (e.g., disclaimers, boilerplate).</p>
```

### 6. Google's Crawlable Link Rules
Per [Google's official guidance](https://developers.google.com/search/docs/crawling-indexing/links-crawlable), only the following link patterns are reliably crawlable:

```html
<!-- ✅ Crawlable by Google -->
<a href="/page">Link text</a>
<a href="/page">
  <img src="/img.webp" alt="Image link" />
</a>

<!-- ❌ NOT reliably crawlable -->
<a routerLink="/page">Angular routerLink without href</a>
<span onclick="location='/page'">JS click handler</span>
<a href="javascript:goTo('/page')">JavaScript href</a>
```

> **Key rule from Google:** Googlebot only follows links in `<a>` elements with an `href` attribute that resolves to a URL.

## Verification
- **Code review:** Ensure no `onClick` routing is used where an `<a>` with `href` should exist.
- **DOM validation:** Verify only one `<h1>` tag exists per page and heading hierarchy is sequential.
- **Media review:** Check that `<img>` tags have descriptive `alt` attributes, explicit dimensions, and lazy-loading where appropriate.
- **Lighthouse audit:** Run a Lighthouse SEO audit and confirm score ≥ 90.

## Failure modes / debugging
| Problem | Cause | Fix |
|---|---|---|
| "Content not indexed" | JavaScript-only navigation; Googlebot can't follow links | Replace `onClick` handlers with `<a href>` or framework `<Link>` |
| Multiple `<h1>` tags detected | Component reuse or CMS template error | Audit templates; ensure only the page-level component renders `<h1>` |
| High CLS score | Images without `width`/`height` cause layout shift | Always set explicit `width` and `height` on `<img>` tags |
| Low accessibility score | Missing `alt` text on images | Add descriptive `alt` text to every `<img>` |

## Escalation
- If the framework fundamentally cannot render `<a>` tags for navigation (e.g., a native WebView bridge), consult a human SEO engineer for a pre-rendering or SSR strategy.
- If the CMS auto-generates heading structures that violate hierarchy, escalate to the CMS admin or template developer.
