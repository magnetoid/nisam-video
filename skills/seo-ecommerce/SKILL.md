---
title: Ecommerce SEO
description: Best practices for ecommerce URL structures, pagination, faceted navigation, and Product structured data.
version: 1.0.0
---

# SEO: Ecommerce Operations

## When to use
Use this skill when:
- Designing or modifying URL structures for products, categories, or filters.
- Implementing product variations (colors, sizes, etc.).
- Building pagination, "Load More" buttons, or infinite scroll for product grids.
- Creating faceted navigation or filtering systems.
- Implementing structured data for single products or grouped products (variants).

## Inputs required
- The product catalog structure and how variants are handled.
- The pagination UX (numbered pages, infinite scroll, load more).
- The filtering/sorting parameters used by the store.
- Pricing, reviews, and availability data for schema markup.

## Procedure

### 1. URL Structure for Products and Variants
Google needs clear, static-looking URLs to understand ecommerce catalogs.

- Use descriptive words in URLs, not just IDs.
- Use `?key=value` for parameters, not just `?value`.
- Avoid temporary parameters (session IDs, timestamps) in crawlable links.

```html
<!-- ✅ CORRECT: Descriptive path -->
<a href="/products/mens-running-shoes">Running Shoes</a>

<!-- ❌ WRONG: Non-descriptive, parameter-only, or multi-value -->
<a href="/products/1234">Running Shoes</a>
<a href="/products/shoes?green">Green Shoes</a>
<a href="/products?type=shoes&type=green">Green Shoes</a>
```

#### Handling Product Variants (e.g., Colors, Sizes)
Make every variant accessible via a unique URL so Google can index specific colors/sizes.

```html
<!-- ✅ Strategy A: Path segment -->
<a href="/products/classic-t-shirt/green">Green T-Shirt</a>

<!-- ✅ Strategy B: Query parameter -->
<a href="/products/classic-t-shirt?color=green">Green T-Shirt</a>
```

If using query parameters for variants, Google recommends setting the canonical URL to the base product URL (omitting the query parameter) to consolidate indexing signals.

### 2. Pagination Best Practices
Google must be able to crawl deeply into product categories.

- **Must use `<a href>`:** Googlebot does not click buttons or trigger JavaScript. You must provide real links to the next page.
- **Sequential Linking:** Link page 1 to page 2, page 2 to page 3, etc.
- **Unique URLs:** Use `?page=n` to give each page a unique URL.
- **Do NOT canonicalize to page 1:** Every paginated URL must have a self-referencing canonical tag.
- **Never use URL fragments (`#page2`):** Google ignores everything after the hash.

```html
<!-- ✅ CORRECT: True links for pagination -->
<nav class="pagination">
  <a href="/category/shoes?page=1">1</a>
  <a href="/category/shoes?page=2">2</a>
  <a href="/category/shoes?page=3" rel="next">Next</a>
</nav>

<!-- ❌ WRONG: Uncrawlable JavaScript pagination -->
<button onclick="loadPage(2)">Load More</button>
<div onscroll="infiniteScroll()">...</div>
<a href="#page2">Page 2</a>
```

> **Note on Infinite Scroll:** If using infinite scroll, you MUST implement the History API to update the URL to `?page=n` as the user scrolls, AND provide `<a href="?page=2">` fallback links in the DOM for crawlers.

### 3. Faceted Navigation and Crawl Budget
Ecommerce filters (price sorting, size, brand) can create infinite URL combinations, draining Google's crawl budget and causing duplicate content issues.

Avoid indexing URLs with filters or alternative sort orders.

```html
<!-- An unfiltered category page (Indexable) -->
<link rel="canonical" href="https://store.com/category/shoes" />
<meta name="robots" content="index, follow" />

<!-- A filtered/sorted category page (Do not index) -->
<!-- https://store.com/category/shoes?sort=price_low&size=10 -->
<meta name="robots" content="noindex, follow" />
```

Alternatively, use `robots.txt` to block parameter crawling:
```text
# robots.txt
User-agent: *
Disallow: /*?sort=
Disallow: /*&size=
```

### 4. Product Structured Data
To get product rich results (price, rating, availability in SERPs), you must include `Product` structured data.

See the dedicated [Product Schema Reference](references/product-schema.md) for full JSON-LD templates covering:
- Single Products with Offers and Reviews
- `ProductGroup` for parent products with multiple variants

### 5. Site Navigation Hierarchy
Google infers page importance from internal link structure. Your navigation must create a clear hierarchy: **Homepage → Category → Subcategory → Product**.

- **Link all products from category pages.** Googlebot does NOT use search boxes to discover products. If a product is only findable via site search, it won't be indexed.
- **Use `<a href>` for all navigation links.** JavaScript event handlers on `<div>` or `<span>` elements are not crawlable.
- **Promote best-sellers.** Link to top products from the homepage or blog posts. More internal links = higher inferred importance.

```html
<!-- ✅ CORRECT: Crawlable category hierarchy -->
<nav>
  <a href="/shoes">Shoes</a>
  <a href="/shoes/running">Running Shoes</a>
  <a href="/shoes/casual">Casual Shoes</a>
</nav>

<!-- Category page links to ALL products in the category -->
<ul class="product-grid">
  <li><a href="/shoes/running/air-max">Nike Air Max</a></li>
  <li><a href="/shoes/running/ultraboost">Adidas Ultraboost</a></li>
  <!-- Every product must have a link here -->
</ul>
```

> **Fallback:** If linking to ALL products from category pages is impossible (e.g., thousands of products), supplement with a sitemap or Google Merchant Center feed to ensure full coverage.

### 6. Google Merchant Center Integration
Google Merchant Center is the primary channel for appearing in Google Shopping, Google Lens, and Google Maps product results.

- **Small catalogs:** Use Google's [automated feed](https://support.google.com/merchants/answer/7538732) which extracts product data from your structured data markup.
- **Large/frequently changing catalogs:** Upload [data feed files](https://support.google.com/merchants/answer/188477) periodically, or use the [Content API](https://developers.google.com/shopping-content/guides/quickstart) for real-time updates.
- **Sync protection:** Enable [automatic item updates](https://support.google.com/merchants/answer/3246284) so Merchant Center corrects price/availability mismatches from your website automatically.

| Google Surface | Requires Merchant Center? |
|---|---|
| Google Search (organic) | No (structured data sufficient) |
| Google Shopping tab | **Yes** |
| Google Images | No |
| Google Lens | **Yes** |
| Google Maps (local inventory) | **Yes** |

### 7. Product Reviews & Ratings
High-quality product reviews improve trust and can trigger review rich snippets.

- Accept customer ratings and reviews with structured markup.
- If writing editorial/merchant reviews, demonstrate first-hand expertise with evidence (photos, measurements, comparisons).
- Include quantitative performance metrics (e.g., battery life hours, weight in grams).
- When linking to products in reviews, use `rel="sponsored"` for affiliate links.

```html
<!-- Customer review markup with AggregateRating -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Wireless Noise-Cancelling Headphones",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.6",
    "reviewCount": "234",
    "bestRating": "5"
  },
  "review": [
    {
      "@type": "Review",
      "author": { "@type": "Person", "name": "Alex M." },
      "datePublished": "2025-03-10",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "5"
      },
      "reviewBody": "Excellent noise cancellation. Battery lasts 30+ hours."
    }
  ]
}
</script>
```

### 8. Ecommerce Content Strategy
Google recommends creating content beyond just product listings to reach shoppers at every stage of the buying journey:

- **Company story page** — Build trust about who customers are buying from.
- **Special offers / deals pages** — Use `Offer` schema with `priceValidUntil` for seasonal sales.
- **Return & shipping policy pages** — Clear policies build customer trust and may appear in search snippets.
- **Buying guides / comparison articles** — Help customers decide between products.

### 9. Ecommerce Launch Checklist
When launching a new ecommerce site, follow Google's recommended steps:

1. [Verify site ownership](https://support.google.com/webmasters/answer/9008080) with Google Search Console.
2. Submit a sitemap (or use URL Inspection for small catalogs).
3. Track indexing progress in the [Page Indexing report](https://support.google.com/webmasters/answer/7440203).
4. If you have a physical store, [establish business details](https://developers.google.com/search/docs/appearance/establish-business-details).
5. [Sign up for Google Merchant Center](https://support.google.com/merchants/answer/188924).

> **Launch strategies:** You can do a "grand reveal" (everything at once), launch the homepage first to build domain awareness, or launch with products marked as "out of stock" to get indexed before your official launch date.

## Verification
- **URL Inspection:** Verify variant URLs resolve and have the correct canonical tag.
- **Pagination Crawlability:** Disable JavaScript in the browser. Confirm you can still navigate to page 2, 3, etc., using standard `href` links.
- **Canonical Check:** Verify `?page=2` has a canonical tag pointing to `?page=2`, NOT page 1.
- **Facet Indexing Check:** Verify filter combinations (e.g., `?color=red&size=large`) contain a `noindex` tag or are blocked in robots.txt.
- **Navigation Crawl Test:** From the homepage, follow only `<a href>` links — can you reach every product? If not, add links or a sitemap.
- **Rich Results Test:** Run product pages through [search.google.com/test/rich-results](https://search.google.com/test/rich-results) to validate schema.
- **Merchant Center Diagnostics:** Check for feed errors, price mismatches, and disapproved products.

## Failure modes / debugging
| Problem | Cause | Fix |
|---|---|---|
| Deep products not indexed | Pagination relies on JS `onclick` or infinite scroll without hrefs | Add `<a>` tags with `href="?page=n"` alongside JS logic |
| "Duplicate, Google chose different canonical than user" | Variants use query params but self-canonicalize | Aim canonicals for variant query params (e.g. `?color=red`) back to the base URL |
| Millions of excluded URLs in GSC | Search facets (filters/sorts) are being crawled | Add `noindex` to filtered views or block parameters in `robots.txt` |
| Missing price in search results | Invalid or missing `Product` > `Offer` schema | Fix JSON-LD according to schema guidelines |
| Products not found by Google | Only discoverable via site search, not linked from categories | Add `<a href>` links from category pages or submit a sitemap |
| Price mismatch in Google Shopping | Merchant Center feed out of sync with website | Enable automatic item updates in Merchant Center settings |
| No review stars in SERPs | Missing `AggregateRating` in Product schema | Add `aggregateRating` with `ratingValue` and `reviewCount` |
| Products not appearing on Google Shopping tab | Not registered with Google Merchant Center | Sign up for Merchant Center and submit product feed |

## Escalation
- If faceted navigation generates millions of indexable pages and crawl budget is exhausted, escalate to a Technical SEO to design a comprehensive parameter handling strategy.
- For complex `ProductGroup` schema mapping with headless variants, consult the backend team to ensure inventory data aligns with structured data requirements.
- If Merchant Center feed validation fails repeatedly, consult the ecommerce platform or feed management tool vendor.

### References
- [Google: SEO Best Practices for Ecommerce](https://developers.google.com/search/docs/specialty/ecommerce)
- [Google: Designing a URL structure for ecommerce](https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites)
- [Google: Pagination & incremental loading](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading)
- [Google: Share your product data](https://developers.google.com/search/docs/specialty/ecommerce/share-your-product-data-with-google)
- [Google: Help Google understand your site structure](https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure)
- [Google: Write high quality reviews](https://developers.google.com/search/docs/specialty/ecommerce/write-high-quality-reviews)
- [Google: How to launch an ecommerce website](https://developers.google.com/search/docs/specialty/ecommerce/how-to-launch-an-ecommerce-website)

