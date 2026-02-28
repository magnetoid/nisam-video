---
title: SEO Meta Tags & Open Graph
description: Rules for implementing title tags, meta descriptions, Open Graph, and Twitter Card markup.
version: 1.0.0
---

# SEO: Meta Tags & Open Graph

## When to use
Use this skill when:
- Creating new pages that need to appear in search results.
- Optimizing social sharing previews (Facebook, Twitter/X, LinkedIn, Slack).
- Setting up dynamic meta tags for CMS-driven or templated pages.
- Auditing or fixing missing/duplicate meta tags.

## Inputs required
- The page title and a concise description (150-160 characters).
- A representative image for social sharing (1200×630px recommended).
- The page's canonical URL.
- The site name and Twitter handle (if applicable).

## Procedure

### 1. Title Tag
- Every page MUST have a unique `<title>`.
- Keep titles under 60 characters to avoid truncation in SERPs.
- Use the format: `Primary Keyword — Secondary Keyword | Brand Name`.

```html
<title>Complete Guide to Technical SEO | Example Corp</title>
```

### 2. Meta Description
- Every page MUST have a unique `<meta name="description">`.
- Keep descriptions between 120-160 characters.
- Include a clear value proposition and a call to action when appropriate.

```html
<meta name="description" content="Learn technical SEO best practices including Core Web Vitals, structured data, and crawl optimization. Updated for 2025." />
```

### 3. Open Graph Tags (Facebook, LinkedIn, Slack)
- Required for rich social sharing previews.

```html
<meta property="og:type" content="website" />
<meta property="og:title" content="Complete Guide to Technical SEO" />
<meta property="og:description" content="Learn technical SEO best practices including Core Web Vitals, structured data, and crawl optimization." />
<meta property="og:image" content="https://example.com/images/og-seo-guide.png" />
<meta property="og:url" content="https://example.com/blog/technical-seo" />
<meta property="og:site_name" content="Example Corp" />
```

### 4. Twitter Card Tags
- Use `summary_large_image` for article/blog content.

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Complete Guide to Technical SEO" />
<meta name="twitter:description" content="Learn technical SEO best practices including Core Web Vitals, structured data, and crawl optimization." />
<meta name="twitter:image" content="https://example.com/images/og-seo-guide.png" />
<meta name="twitter:site" content="@examplecorp" />
```

### 5. Complete Head Template

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Page Title | Brand</title>
  <meta name="description" content="Page description under 160 chars." />
  <link rel="canonical" href="https://example.com/current-page" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Page Title" />
  <meta property="og:description" content="Page description." />
  <meta property="og:image" content="https://example.com/og-image.png" />
  <meta property="og:url" content="https://example.com/current-page" />
  <meta property="og:site_name" content="Brand Name" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Page Title" />
  <meta name="twitter:description" content="Page description." />
  <meta name="twitter:image" content="https://example.com/og-image.png" />
</head>
```

### 6. Framework Examples

```jsx
// Next.js App Router (metadata export)
export const metadata = {
  title: 'Page Title | Brand',
  description: 'Page description under 160 chars.',
  openGraph: {
    title: 'Page Title',
    description: 'Page description.',
    images: [{ url: 'https://example.com/og-image.png', width: 1200, height: 630 }],
    url: 'https://example.com/current-page',
    siteName: 'Brand Name',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Page Title',
    description: 'Page description.',
    images: ['https://example.com/og-image.png'],
  },
};
```

### 7. Favicon in Search Results
- Google shows favicons in mobile and desktop search results next to your site name.
- Provide a favicon for brand recognition in SERPs.

```html
<link rel="icon" href="/favicon.ico" sizes="48x48" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

> Google's requirements: favicon must be a multiple of 48×48px, accessible to Googlebot (not blocked by robots.txt), and visually representative of your brand.

### 8. Site Name in Search Results
- Use `WebSite` structured data to control the site name displayed in search results.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Example Corp",
  "alternateName": "EC",
  "url": "https://example.com"
}
</script>
```

### 9. Publication and Byline Dates
- Google may display article dates in search results.
- Use structured data (`datePublished`, `dateModified`) and visible on-page dates.

```html
<!-- Visible date on page -->
<time datetime="2025-01-15">January 15, 2025</time>

<!-- In Article JSON-LD -->
"datePublished": "2025-01-15T08:00:00+00:00",
"dateModified": "2025-02-01T10:30:00+00:00"
```

> Google recommends showing a visible date on the page that matches the structured data. Don't change `dateModified` without meaningful content changes.

## Verification
- **Google SERP preview:** Use [mangools.com/free-seo-tools/serp-simulator](https://mangools.com/free-seo-tools/serp-simulator) to preview how the title and description appear.
- **Social preview:** Use [opengraph.xyz](https://www.opengraph.xyz/) to test Open Graph rendering.
- **Twitter preview:** Use [cards-dev.twitter.com/validator](https://cards-dev.twitter.com/validator) to test Twitter Card rendering.
- **Uniqueness check:** Ensure no two pages share the same title or description.

## Failure modes / debugging
| Problem | Cause | Fix |
|---|---|---|
| Title truncated in SERPs | Title exceeds 60 characters | Shorten the title; put the most important keywords first |
| Social share shows wrong image | Missing `og:image` or wrong dimensions | Add `og:image` with 1200×630px image using absolute URL |
| Duplicate meta descriptions | Template not customizing per page | Use dynamic meta generation from page content or CMS fields |
| Description not showing in Google | Google rewrites descriptions for relevance | Write descriptions that directly match common search queries |

## Escalation
- If the CMS auto-generates meta tags that conflict with manual overrides, escalate to the CMS admin.
- If social platforms cache old previews, use their respective debug/validator tools to force a re-scrape.
