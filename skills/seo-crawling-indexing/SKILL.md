---
title: SEO Crawling & Indexing
description: Instructions for preventing duplicate content, setting robots directives, and automating sitemap generation.
version: 1.0.0
---

# SEO: Crawling & Indexing

## When to use
Use this skill when:
- Creating new routes, pages, or dynamic URL segments.
- Managing user-state pages (dashboards, settings, carts, account areas).
- Configuring indexing rules or canonicalization strategy.
- Setting up, modifying, or debugging XML sitemaps.
- Deploying a new site or migrating URLs.

## Inputs required
- The site's domain and URL structure.
- Which pages are public-facing vs. private/user-state.
- The framework's routing mechanism (file-based, config-based, dynamic).
- Whether the site uses SSR, SSG, or CSR.

## Procedure

### 1. Canonicalization
- Every public-facing page MUST include a self-referencing canonical tag in `<head>`.
- Use the absolute URL including the protocol and domain.

```html
<!-- On page: https://example.com/blog/seo-guide -->
<head>
  <link rel="canonical" href="https://example.com/blog/seo-guide" />
</head>
```

```jsx
// Next.js example
export const metadata = {
  alternates: {
    canonical: 'https://example.com/blog/seo-guide',
  },
};
```

### 2. Robots Directives
- Private or user-state pages must NOT be indexed.
- Inject `noindex, nofollow` in `<head>` for these routes.

```html
<!-- Dashboard, cart, settings, account pages -->
<meta name="robots" content="noindex, nofollow" />
```

- For site-wide crawl rules, maintain a `robots.txt` file:

```txt
# robots.txt
User-agent: *
Allow: /
Disallow: /dashboard/
Disallow: /cart/
Disallow: /account/
Sitemap: https://example.com/sitemap.xml
```

### 3. Sitemap Automation
- Ensure all public routes are included in `sitemap.xml`.
- Include `<lastmod>` tags with ISO 8601 dates.
- Exclude private routes, paginated duplicates, and utility pages.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2025-01-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/blog/seo-guide</loc>
    <lastmod>2025-01-10</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

### 4. Outbound Link Qualification
- Use `rel` attributes to tell Google your relationship with linked pages.
- Regular editorial links don't need any `rel` attribute.

```html
<!-- Paid/sponsored link -->
<a rel="sponsored" href="https://partner.com/product">Partner Product</a>

<!-- User-generated content (comments, forums) -->
<a rel="ugc" href="https://example.com/user-post">User's post</a>

<!-- Don't pass PageRank / don't associate -->
<a rel="nofollow" href="https://example.com/untrusted">External link</a>

<!-- Combine multiple values -->
<a rel="ugc nofollow" href="https://example.com/comment-link">Comment link</a>
```

| `rel` Value | Use When |
|---|---|
| `sponsored` | Ads, paid placements, affiliate links |
| `ugc` | User-generated content (comments, forum posts) |
| `nofollow` | You don't want to endorse or pass PageRank to the link |

### 5. Snippet Control Directives
- Control how Google displays your content in search result snippets.
- Use `data-nosnippet` to exclude specific text from snippets.

```html
<!-- Control snippet length and image preview size -->
<meta name="robots" content="max-snippet:160, max-image-preview:large" />

<!-- Exclude specific text from appearing in snippets -->
<p>This text can appear in snippets.</p>
<p data-nosnippet>This text will NOT appear in Google snippets.</p>
```

| Directive | Effect |
|---|---|
| `max-snippet:N` | Limit text snippet to N characters |
| `max-image-preview:large` | Allow large image previews (none, standard, large) |
| `max-video-preview:N` | Limit video preview to N seconds (-1 = no limit) |
| `nosnippet` | Don't show any snippet |
| `data-nosnippet` | Exclude specific HTML elements from snippets |

### 6. HTTP Status Codes and Google Search
- Use correct HTTP status codes — they directly affect how Google treats your pages.

| Status Code | Google's Behavior |
|---|---|
| `200` | Page is crawled and eligible for indexing |
| `301` | Permanent redirect — PageRank transfers to new URL |
| `302` | Temporary redirect — original URL stays in index |
| `404` / `410` | Page removed from index (410 is faster) |
| `503` | Temporary unavailability — Google retries later |
| `429` | Too many requests — Google slows crawl rate |

## Verification
- **Route inspection:** Ensure every public page has a valid self-referencing canonical tag.
- **Source code validation:** Verify private/user-state routes contain `noindex, nofollow`.
- **robots.txt check:** Confirm `robots.txt` exists, allows public routes, and blocks private ones.
- **Sitemap validation:** Ensure `sitemap.xml` builds correctly, contains only public URLs, and dynamically updates `<lastmod>`.

## Failure modes / debugging
| Problem | Cause | Fix |
|---|---|---|
| Duplicate content penalty | Missing or incorrect canonical tags | Add self-referencing `<link rel="canonical">` to every public page |
| Private pages appearing in search | Missing `noindex` meta tag | Add `<meta name="robots" content="noindex, nofollow" />` |
| Sitemap returns 404 | Not generated during build or wrong path | Verify build pipeline generates `sitemap.xml` at the root |
| Stale `<lastmod>` dates | Hardcoded dates instead of dynamic values | Use content last-modified timestamps from CMS or file system |
| Crawl budget waste | Too many low-value URLs in sitemap | Exclude pagination, filters, and utility pages from sitemap |

## Escalation
- If the site has thousands of dynamic URLs and crawl budget is an issue, consult a human SEO engineer for pagination strategy and sitemap index files.
- If canonical tags conflict with CMS-generated canonicals (e.g., Shopify, WordPress), escalate to the platform admin.
