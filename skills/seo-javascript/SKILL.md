---
title: JavaScript SEO
description: Rules for making JavaScript-rendered content crawlable and indexable by Google, covering SPAs, SSR, History API, soft 404s, and Web Components.
version: 1.0.0
---

# SEO: JavaScript SEO

## When to use
Use this skill when:
- Building single-page applications (SPAs) with React, Vue, Angular, Svelte, or similar.
- Choosing between server-side rendering (SSR), static site generation (SSG), and client-side rendering (CSR).
- Implementing client-side routing in an SPA.
- Handling error states (404, empty data) in client-rendered apps.
- Adding lazy-loaded content or dynamic imports.
- Using Web Components or Shadow DOM.

## Inputs required
- The JavaScript framework in use (React, Next.js, Nuxt, Angular, SvelteKit, Astro, etc.).
- The rendering strategy (SSR, SSG, CSR, ISR).
- Whether the app uses client-side routing (React Router, Vue Router, etc.).
- Key content that must be indexed by Google.

## Procedure

### 1. Understand Google's JavaScript Processing Pipeline
Google processes JS apps in three phases: **Crawl → Render → Index**.
- Googlebot first fetches the HTML (may be an empty app shell in CSR).
- The page is queued for rendering by Google's Web Rendering Service (WRS), which runs headless Chromium.
- After rendering, Google parses the final DOM for links and content to index.

> **Critical:** Server-side rendering (SSR) or static generation (SSG) is strongly recommended. It makes content immediately available to crawlers without waiting for the render queue.

### 2. Use the History API — Never Hash Fragments
- Google cannot reliably follow hash-based routes (`#/page`).
- Always use the History API (`pushState`) for client-side routing.
- Framework routers (React Router, Vue Router) already use the History API by default.

```html
<!-- ❌ WRONG — Hash fragments, not crawlable -->
<a href="#/products">Products</a>
<a href="#/about">About</a>

<!-- ✅ CORRECT — Real paths, crawlable -->
<a href="/products">Products</a>
<a href="/about">About</a>
```

### 3. Handle Soft 404s in SPAs
When a client-rendered page has no content (e.g., a deleted product), Google sees a `200` status but empty content — a "soft 404." Fix with one of these strategies:

**Strategy A: Redirect to a server-side 404**
```javascript
fetch(`/api/products/${productId}`)
  .then(res => res.json())
  .then(product => {
    if (!product.exists) {
      // Redirect to a URL that returns a real 404 status
      window.location.href = '/not-found';
      return;
    }
    renderProduct(product);
  });
```

**Strategy B: Inject a `noindex` meta tag**
```javascript
fetch(`/api/products/${productId}`)
  .then(res => res.json())
  .then(product => {
    if (!product.exists) {
      const meta = document.createElement('meta');
      meta.name = 'robots';
      meta.content = 'noindex';
      document.head.appendChild(meta);
      showErrorMessage();
      return;
    }
    renderProduct(product);
  });
```

### 4. Content Fingerprinting for Cache Busting
- Google's WRS may ignore HTTP cache headers and serve stale JS/CSS.
- Use content fingerprinting in filenames (e.g., `main.2bb85551.js`).
- Most bundlers (Webpack, Vite, esbuild) support this by default.

```javascript
// vite.config.js — Vite does this by default
export default {
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
  },
};
```

### 5. Set Meta Tags and Canonicals via JavaScript
- Google's WRS picks up `<title>`, `<meta>`, and `<link rel="canonical">` injected via JavaScript.
- But prefer setting them server-side when possible for reliability.

```javascript
// Update title and description dynamically
document.title = 'Product Name — Brand';

const metaDesc = document.querySelector('meta[name="description"]');
if (metaDesc) {
  metaDesc.setAttribute('content', 'New description for this page.');
}
```

### 6. Web Components and Shadow DOM
- Google flattens Shadow DOM content during rendering.
- Content must be visible in the rendered HTML to be indexed.
- Use `<slot>` elements to project Light DOM content into Shadow DOM.

```html
<script>
class MyCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <div class="card">
        <slot></slot>  <!-- Light DOM content projected here -->
      </div>`;
  }
}
customElements.define('my-card', MyCard);
</script>

<!-- Content in Light DOM is indexable -->
<my-card>
  <h2>Product Title</h2>
  <p>This content is visible to Google.</p>
</my-card>
```

### 7. Lazy-Loading Best Practices
- Don't lazy-load above-the-fold content or critical SEO content.
- Use native `loading="lazy"` on images — Google supports it.
- For infinite scroll, ensure items have proper `<a href>` links so Google can discover all pages.

## Verification
- **Rich Results Test:** [search.google.com/test/rich-results](https://search.google.com/test/rich-results) — Shows the rendered HTML as Google sees it.
- **URL Inspection Tool:** Use in Google Search Console to see how Googlebot renders a specific URL.
- **JavaScript disabled test:** View your site with JavaScript disabled — if critical content disappears, you need SSR/SSG.
- **`site:yourdomain.com`:** Search Google to verify your pages are indexed.

## Failure modes / debugging
| Problem | Cause | Fix |
|---|---|---|
| Pages not indexed | Content only in client-rendered JS, Googlebot times out | Implement SSR or SSG |
| Soft 404 warnings in Search Console | SPA returns 200 for pages with no content | Redirect to real 404 URL or inject `noindex` meta tag |
| Links not discovered | Hash-based routing (`#/route`) | Switch to History API with real URL paths |
| Stale content indexed | Google's WRS cached old JS bundle | Use content fingerprinting in filenames |
| Shadow DOM content missing | Content inside Shadow DOM without `<slot>` | Use `<slot>` to project Light DOM content |
| Lazy-loaded content invisible | Critical content behind scroll/click interaction | Ensure primary content loads without user interaction |

## Escalation
- If the app is a pure CSR SPA and cannot implement SSR, consult a DevOps engineer about pre-rendering services (e.g., Rendertron, Prerender.io).
- If Google Search Console shows persistent rendering issues, escalate to a technical SEO specialist to audit the WRS output.

### References
- [Google: JavaScript SEO Basics](https://developers.google.com/search/docs/guides/javascript-seo-basics)
- [Google: Fix Search-related JavaScript problems](https://developers.google.com/search/docs/guides/fix-search-javascript)
- [web.dev: Rendering on the Web](https://web.dev/articles/rendering-on-the-web)
