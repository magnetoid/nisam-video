---
title: Advanced SEO Schema & Snippets
description: Guidelines for implementing JSON-LD structured data and optimizing content for Featured Snippets.
version: 1.0.0
---

# Advanced SEO: Schema & Snippets

## When to use
Use this skill when:
- Creating content-heavy pages (blogs, articles, FAQs, product pages, local business pages).
- Writing informational text blocks that could qualify for Featured Snippets.
- Adding structured data to improve rich result eligibility in SERPs.
- Implementing e-commerce product markup or review aggregation.

## Inputs required
- The content type of the page (article, FAQ, product, local business, recipe, event, etc.).
- Key data points: author, dates, prices, ratings, addresses, etc.
- Whether the content aims for paragraph, list, or table Featured Snippets.

## Procedure

### 1. JSON-LD Schema Implementation
- Inject a `<script type="application/ld+json">` block in the `<head>` or end of `<body>`.
- Always set `@context` to `"https://schema.org"`.
- Match `@type` to the page content.

```html
<!-- Article page -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Complete Guide to Technical SEO",
  "author": {
    "@type": "Person",
    "name": "Jane Smith"
  },
  "datePublished": "2025-01-15",
  "dateModified": "2025-02-01",
  "image": "https://example.com/images/seo-guide.webp",
  "publisher": {
    "@type": "Organization",
    "name": "Example Corp",
    "logo": {
      "@type": "ImageObject",
      "url": "https://example.com/logo.png"
    }
  }
}
</script>
```

```html
<!-- FAQ page -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is technical SEO?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Technical SEO refers to optimizations that help search engines crawl and index your site more effectively."
      }
    }
  ]
}
</script>
```

### 2. The Inverted Pyramid
- The first 40-50 words of an informational block MUST directly answer the user's query.
- Provide the concise answer first, then expand on details.

```html
<!-- ✅ CORRECT — Direct answer first -->
<p>Technical SEO is the practice of optimizing a website's infrastructure
so search engines can crawl, index, and render it effectively. It covers
site speed, mobile-friendliness, structured data, and crawl efficiency.
Unlike content SEO, it focuses on the code and architecture rather than
the words on the page.</p>

<!-- ❌ WRONG — Buries the answer -->
<p>In today's digital landscape, businesses need to understand many
aspects of online marketing. One important area that often gets
overlooked is something called technical SEO, which we'll explain
below after some background context...</p>
```

### 3. Data Extraction Formats
- Use `<ul>` / `<ol>` for list-based snippets.
- Use `<table>` for comparison/tabular data.
- Never render structured data as comma-separated text in a `<p>` tag.

```html
<!-- ✅ CORRECT — Structured list -->
<h2>Benefits of Technical SEO</h2>
<ul>
  <li>Faster page load times</li>
  <li>Improved crawl efficiency</li>
  <li>Better mobile experience</li>
  <li>Enhanced rich results in SERPs</li>
</ul>

<!-- ✅ CORRECT — Comparison table -->
<table>
  <thead>
    <tr><th>Feature</th><th>Technical SEO</th><th>Content SEO</th></tr>
  </thead>
  <tbody>
    <tr><td>Focus</td><td>Infrastructure</td><td>Content quality</td></tr>
    <tr><td>Tools</td><td>Lighthouse, GSC</td><td>Ahrefs, SEMrush</td></tr>
  </tbody>
</table>
```

### 4. WebSite Schema (Sitelinks Search Box & Site Name)
- Add `WebSite` schema to your homepage to enable a sitelinks search box in Google results.
- This also controls the site name displayed in SERPs.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Example Corp",
  "url": "https://example.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://example.com/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
</script>
```

### 5. VideoObject Schema
- Add `VideoObject` structured data when embedding videos to enable video rich results.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "How to Optimize Core Web Vitals",
  "description": "Step-by-step guide to improving LCP, CLS, and INP scores.",
  "thumbnailUrl": "https://example.com/thumbnails/cwv-guide.jpg",
  "uploadDate": "2025-01-15",
  "duration": "PT8M30S",
  "contentUrl": "https://example.com/videos/cwv-guide.mp4",
  "embedUrl": "https://www.youtube.com/embed/abc123"
}
</script>
```

### 6. Sitelinks Best Practices
- Google automatically generates sitelinks for sites with clear structure.
- To improve sitelinks quality:
  - Use descriptive, unique page titles.
  - Create a logical site hierarchy.
  - Ensure important pages are linked from navigation.
  - Use `BreadcrumbList` schema to define page hierarchy.

## Verification
- **JSON-LD validation:** Paste output into [Google Rich Results Test](https://search.google.com/test/rich-results) or [Schema.org Validator](https://validator.schema.org/).
- **Content review:** Check if informational blocks start with a direct answer within the first ~50 words.
- **HTML structure check:** Verify `<ul>`, `<ol>`, and `<table>` elements are used for structured data—not `<p>` with comma-separated text.

## Failure modes / debugging
| Problem | Cause | Fix |
|---|---|---|
| "Missing field" errors in Rich Results Test | Required properties omitted (e.g., `author`, `datePublished`) | Add all required properties for the schema `@type` |
| Schema not detected | JSON-LD syntax error (trailing commas, unescaped quotes) | Validate JSON with a linter before deploying |
| No Featured Snippet despite good content | Answer not in first 40-50 words, or not using structured HTML | Restructure content using the inverted pyramid pattern |
| Duplicate schema on page | Multiple components inject the same schema type | Centralize schema injection at the page/layout level |

## Escalation
- If the page requires a complex nested schema (e.g., `Product` with `AggregateRating`, `Offer`, and `Review`), consult the [Schema.org documentation](https://schema.org/) or a human SEO engineer.
- If schema conflicts with CMS-generated structured data, escalate to the platform admin.
