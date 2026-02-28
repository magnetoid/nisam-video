---
title: SEO International & Multilanguage
description: Comprehensive rules for multilingual and multi-regional websites, including hreflang implementation, geotargeting, locale-adaptive pages, and common mistakes.
version: 2.0.0
---

# SEO: International & Multilanguage

## When to use
Use this skill when:
- Building a multilingual website (content in multiple languages).
- Building a multi-regional website (same language, different countries — e.g., US vs UK English).
- Adding language/locale variants of existing pages.
- Implementing `hreflang` tags via HTML, HTTP headers, or sitemaps.
- Handling locale-adaptive pages that change content based on user location.
- Configuring geotargeting for specific countries.
- Managing cross-domain duplicate content (e.g., `example.de` and `example.com/de/`).

## Inputs required
- Target languages and regions (e.g., `en-US`, `es-ES`, `fr-FR`, `zh-Hans`).
- URL strategy: subdirectories (`/en/`), subdomains (`en.example.com`), or separate domains (`example.de`).
- Whether content is fully translated, partially localized, or user-generated (e.g., forums).
- Whether the site serves different content based on user IP or `Accept-Language` header.

## Procedure

### 1. Understand Multilingual vs Multi-Regional
These are distinct concepts per Google:
- **Multilingual**: Content in multiple languages (e.g., English + French site for Canada).
- **Multi-regional**: Same language targeting different countries (e.g., `en-US` vs `en-GB`).
- A site can be **both** (e.g., a Canadian site with English and French content targeting Canada specifically).

### 2. Use Different URLs for Every Language Version
Google strongly recommends **separate URLs** for each language version — never change content based on cookies or browser settings alone.

> **Critical:** Googlebot crawls from the USA and does NOT send an `Accept-Language` header. If you serve different content based on IP or headers, Googlebot will only see the US English version.

```html
<!-- ✅ CORRECT: Separate URLs per language -->
https://example.com/en/about
https://example.com/es/about
https://example.com/fr/about

<!-- ❌ WRONG: Same URL, content changes based on cookie/IP -->
https://example.com/about  (shows English or Spanish depending on location)
```

### 3. URL Strategy

| Strategy | Example | Best For |
|---|---|---|
| Subdirectories | `example.com/en/`, `example.com/es/` | Most sites — single domain authority, simplest |
| Subdomains | `en.example.com`, `es.example.com` | Large teams with separate infrastructure |
| ccTLDs | `example.com`, `example.de`, `example.es` | Strong local brand or geo-targeting per country |

- Use **UTF-8 encoding** for localized words in URLs (e.g., `example.com/über-uns/`).
- Internationalized Domain Names (IDNs) are fine, but escape URLs properly when linking.

### 4. Hreflang Tags — Three Methods

Google supports three ways to declare language variants. **Use only one method per page** (don't mix):

#### Method A: HTML `<link>` Tags (most common)
```html
<head>
  <!-- Self-referencing + all alternate versions -->
  <link rel="alternate" hreflang="en" href="https://example.com/en/about" />
  <link rel="alternate" hreflang="es" href="https://example.com/es/about" />
  <link rel="alternate" hreflang="fr" href="https://example.com/fr/about" />
  <link rel="alternate" hreflang="de-CH" href="https://example.com/de-ch/about" />
  <link rel="alternate" hreflang="x-default" href="https://example.com/en/about" />
</head>
```

#### Method B: HTTP Headers (for PDFs and non-HTML files)
```http
Link: <https://example.com/file.pdf>; rel="alternate"; hreflang="en",
      <https://de.example.com/file.pdf>; rel="alternate"; hreflang="de",
      <https://de-ch.example.com/file.pdf>; rel="alternate"; hreflang="de-ch"
```

#### Method C: XML Sitemap
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://example.com/en/about</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/en/about" />
    <xhtml:link rel="alternate" hreflang="es" href="https://example.com/es/about" />
    <xhtml:link rel="alternate" hreflang="fr" href="https://example.com/fr/about" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/en/about" />
  </url>
  <url>
    <loc>https://example.com/es/about</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/en/about" />
    <xhtml:link rel="alternate" hreflang="es" href="https://example.com/es/about" />
    <xhtml:link rel="alternate" hreflang="fr" href="https://example.com/fr/about" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/en/about" />
  </url>
</urlset>
```

### 5. Hreflang Rules (from Google)
These rules apply to ALL three methods:

1. **Bidirectional linking is REQUIRED.** If page A references page B, page B MUST reference page A. If not, hreflang tags are ignored.
2. **Self-referencing is required.** Each page must include its own URL in the hreflang set.
3. **Use fully-qualified URLs.** Always `https://example.com/page`, never `//example.com/page` or `/page`.
4. **Always include `x-default`.** Points to the fallback page for users whose language/region doesn't match any variant.
5. **Use ISO 639-1 language + optional ISO 3166-1 Alpha-2 region.** Language code MUST come first.

```
✅ Correct codes:  en, en-US, en-GB, de, de-CH, zh-Hans, zh-Hant, pt-BR
❌ Invalid codes:  be (Belarusian, not Belgium), eu (not a valid region), uk (not GB), es-419 (not supported)
```

> **Belgium gotcha:** Belgium has 3 languages. Use `fr-BE`, `nl-BE`, `de-BE` — never just `be` (that's the Belarusian language code).

### 6. Language Detection — How Google Actually Determines It
Google determines page language from **visible content**, NOT from:
- The `<html lang="">` attribute
- HTTP headers
- URL structure

Set `<html lang="">` for accessibility, but know that Google relies on the actual text content. Don't mix languages on a single page — keep navigation, content, and footer in the same language.

### 7. Locale-Adaptive Pages
If your server returns different content based on visitor IP or `Accept-Language`:

- **Problem:** Googlebot crawls from US IPs without an `Accept-Language` header, so it only sees the US English version.
- **Solution:** Use `hreflang` annotations to tell Google about all versions, AND ensure each version has its own crawlable URL.

### 8. Cross-Domain Duplicate Content
If the same content exists on multiple domains (e.g., `example.de` and `example.com/de/`):
- Pick a preferred version.
- Use `rel="canonical"` on the non-preferred version pointing to the preferred one.
- Use `hreflang` tags on the canonical version to declare all language variants.

```html
<!-- On example.com/de/ (non-preferred) -->
<link rel="canonical" href="https://example.de/" />

<!-- On example.de/ (preferred) -->
<link rel="canonical" href="https://example.de/" />
<link rel="alternate" hreflang="de" href="https://example.de/" />
<link rel="alternate" hreflang="en" href="https://example.com/" />
```

### 9. Content & UX Best Practices
- **Never auto-redirect** based on IP or geo without user consent. Use a banner/prompt instead.
- **Provide a visible language switcher** on all pages.
- **Translate everything** — titles, meta descriptions, navigation, footers. Not just body content.
- **Use a catchall.** If you have `en-IE`, `en-CA`, `en-AU`, also provide a generic `en` for all other English-speaking locations.

```html
<!-- ✅ Language switcher example -->
<nav aria-label="Language selector">
  <a href="/en/about" hreflang="en" lang="en">English</a>
  <a href="/es/about" hreflang="es" lang="es">Español</a>
  <a href="/fr/about" hreflang="fr" lang="fr">Français</a>
</nav>
```

### 10. Framework Implementation

```jsx
// Next.js App Router (metadata export)
export const metadata = {
  alternates: {
    canonical: 'https://example.com/en/about',
    languages: {
      'en': 'https://example.com/en/about',
      'es': 'https://example.com/es/about',
      'fr': 'https://example.com/fr/about',
      'x-default': 'https://example.com/en/about',
    },
  },
};
```

## Verification
- **Hreflang validation:** Use [Aleyda Solis' Hreflang Generator](https://www.aleydasolis.com/english/international-seo-tools/hreflang-tags-generator/) to validate tags.
- **Bidirectional check:** For every hreflang on page A pointing to page B, confirm page B points back to page A.
- **Search Console:** Check the International Targeting report for hreflang errors and coverage.
- **Sitemap check:** Verify multilingual sitemaps include `xhtml:link` elements for every language per URL.
- **HTML lang check:** Confirm `<html lang="...">` matches the page's visible content language.
- **Locale-adaptive test:** Crawl your site from a US IP — does the correct default version appear? Then test with a VPN from another country.
- **Canonical + hreflang consistency:** Ensure canonical tags don't conflict with hreflang (canonical should point to the same URL that hreflang declares for that language).

## Failure modes / debugging
| Problem | Cause | Fix |
|---|---|---|
| Wrong language version ranking | Missing or incorrect hreflang tags | Add bidirectional hreflang tags for all language pairs |
| "Duplicate content" across languages | Missing hreflang `x-default` | Add `x-default` hreflang pointing to the primary/fallback version |
| Users forced to wrong locale | Auto-redirect based on IP | Use a banner/prompt instead of forced redirect |
| Missing translations in SERPs | Meta title/description not translated | Translate all `<title>` and `<meta description>` tags |
| Hreflang tags silently ignored | Missing return (bidirectional) links | Every page in a hreflang set must link to all others, including itself |
| Invalid language codes | Using `uk` instead of `en-GB`, or `eu` | Use ISO 639-1 language + ISO 3166-1 Alpha-2 region codes only |
| Googlebot only sees English version | Locale-adaptive page without separate URLs | Create separate URLs per language and use hreflang annotations |
| Same German content on `example.de` + `.com/de/` | Cross-domain duplicate without canonical | Set `rel="canonical"` on the non-preferred version |

## Escalation
- If the site requires regional pricing, currency, or legal content differences, consult a localization specialist.
- If hreflang conflicts arise from CMS plugins (e.g., WPML, Polylang), escalate to the CMS admin.
- For sites with 50+ language variants, consider using the sitemap method exclusively (easier to maintain at scale).

### References
- [Google: Managing multi-regional and multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
- [Google: Tell Google about localized versions of your page](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Google: How Google crawls locale-adaptive pages](https://developers.google.com/search/docs/specialty/international/locale-adaptive-pages)
