# Robots.txt & Meta Robots Reference

## robots.txt

The `robots.txt` file lives at the root of your domain and controls crawler access at the directory level.

### Syntax

```txt
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /dashboard/
Disallow: /cart/
Sitemap: https://example.com/sitemap.xml
```

### Key Rules
- **One `robots.txt` per domain** — always at `/robots.txt`
- `Disallow` blocks crawling, but does NOT prevent indexing (use meta robots for that)
- Always include `Sitemap:` directive pointing to your XML sitemap
- Test with [Google Search Console Robots Testing Tool](https://search.google.com/search-console/robots-testing-tool)

### Common Patterns

```txt
# Block all crawlers from admin
User-agent: *
Disallow: /admin/

# Block specific bot
User-agent: AhrefsBot
Disallow: /

# Allow everything
User-agent: *
Allow: /
```

## Meta Robots Tag

The `<meta name="robots">` tag controls indexing at the page level.

### Directives

| Directive | Effect |
|---|---|
| `index` | Allow indexing (default) |
| `noindex` | Prevent indexing |
| `follow` | Follow links on the page (default) |
| `nofollow` | Don't follow links |
| `noarchive` | Don't show cached copy |
| `nosnippet` | Don't show snippet in results |
| `max-snippet:N` | Limit snippet to N characters |
| `max-image-preview:large` | Allow large image previews |

### Examples

```html
<!-- Block indexing entirely -->
<meta name="robots" content="noindex, nofollow" />

<!-- Index but don't cache -->
<meta name="robots" content="index, follow, noarchive" />

<!-- Control snippet length -->
<meta name="robots" content="index, follow, max-snippet:160" />
```

## robots.txt vs Meta Robots

| Feature | robots.txt | Meta Robots |
|---|---|---|
| Scope | Directory-level | Page-level |
| Prevents crawling | ✅ | ❌ |
| Prevents indexing | ❌ | ✅ |
| Requires page access | No | Yes (crawler must load the page) |

> **Important:** If you `Disallow` a page in `robots.txt`, the crawler won't see the `noindex` meta tag. To prevent indexing, you must allow crawling but add `noindex`.
