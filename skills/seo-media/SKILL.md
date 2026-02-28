---
title: Image & Video SEO
description: Best practices for optimizing images and videos for Google Search, Google Images, and video search results.
version: 1.0.0
---

# SEO: Image & Video SEO

## When to use
Use this skill when:
- Adding images to pages (hero images, product photos, blog illustrations).
- Embedding videos (YouTube, self-hosted, or third-party players).
- Optimizing for Google Images or video search results.
- Creating image or video sitemaps.
- Implementing responsive images with `<picture>` and `srcset`.

## Inputs required
- The types of media on the page (photos, illustrations, infographics, videos).
- Whether videos are self-hosted or embedded (YouTube, Vimeo).
- The target search experience (web results, Google Images, video carousel).
- Image file formats available (WebP, AVIF, JPEG, PNG).

## Procedure

### 1. Image File Optimization
- Serve images in modern formats: **WebP** or **AVIF** with JPEG/PNG fallbacks.
- Compress images to reduce file size without visible quality loss.
- Use descriptive, keyword-rich file names (not `IMG_1234.jpg`).

```
✅ /images/blue-running-shoes-side-view.webp
❌ /images/IMG_20250115_143022.jpg
❌ /images/photo1.png
```

### 2. Image HTML Best Practices
- Every `<img>` MUST have descriptive `alt` text.
- Set explicit `width` and `height` to prevent CLS.
- Use `loading="lazy"` for below-the-fold images.
- Use `fetchpriority="high"` for the LCP image.

```html
<!-- Hero/LCP image -->
<img src="/images/product-hero.webp"
     alt="Red running shoes with cushioned sole — Nike Air Max"
     width="1200" height="630"
     fetchpriority="high" />

<!-- Below-the-fold image -->
<img src="/images/product-detail.webp"
     alt="Close-up of the shoe's breathable mesh upper"
     width="800" height="450"
     loading="lazy" />
```

### 3. Responsive Images
- Use `<picture>` with `<source>` for art direction or format selection.
- Use `srcset` for resolution switching.

```html
<!-- Format selection (AVIF > WebP > JPEG) -->
<picture>
  <source srcset="/images/hero.avif" type="image/avif" />
  <source srcset="/images/hero.webp" type="image/webp" />
  <img src="/images/hero.jpg" alt="Team collaborating in office"
       width="1200" height="630" />
</picture>

<!-- Resolution switching -->
<img src="/images/product-400.webp"
     srcset="/images/product-400.webp 400w,
             /images/product-800.webp 800w,
             /images/product-1200.webp 1200w"
     sizes="(max-width: 600px) 400px,
            (max-width: 1000px) 800px,
            1200px"
     alt="Product photo" width="1200" height="800" loading="lazy" />
```

### 4. Image Sitemap
- Include important images in your sitemap for better discoverability.

```xml
<url>
  <loc>https://example.com/products/running-shoes</loc>
  <image:image>
    <image:loc>https://example.com/images/blue-running-shoes.webp</image:loc>
    <image:caption>Blue running shoes with cushioned sole</image:caption>
  </image:image>
</url>
```

### 5. Video SEO
- Embed videos with proper HTML — Google needs to discover the video on the page.
- Add `VideoObject` structured data for video rich results.
- Provide a high-quality thumbnail image.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "How to Choose Running Shoes",
  "description": "A complete guide to selecting the right running shoes for your foot type.",
  "thumbnailUrl": "https://example.com/thumbnails/running-shoes-guide.jpg",
  "uploadDate": "2025-01-15",
  "duration": "PT5M30S",
  "contentUrl": "https://example.com/videos/running-shoes-guide.mp4",
  "embedUrl": "https://www.youtube.com/embed/abc123"
}
</script>
```

### 6. Video Sitemap
```xml
<url>
  <loc>https://example.com/blog/running-shoes-guide</loc>
  <video:video>
    <video:thumbnail_loc>https://example.com/thumbnails/guide.jpg</video:thumbnail_loc>
    <video:title>How to Choose Running Shoes</video:title>
    <video:description>A complete guide to selecting running shoes.</video:description>
    <video:content_loc>https://example.com/videos/guide.mp4</video:content_loc>
    <video:duration>330</video:duration>
  </video:video>
</url>
```

### 7. Avoid Common Image Anti-Patterns
- Don't embed important text inside images — Google can't reliably read it.
- Don't use CSS `background-image` for meaningful content images (not indexable).
- Don't block image URLs in `robots.txt`.

```css
/* ❌ WRONG — CSS background images are NOT indexed by Google Images */
.hero { background-image: url('/images/hero.webp'); }

/* ✅ Use an <img> tag instead for indexable images */
```

## Verification
- **Google Images search:** Search `site:yourdomain.com` in Google Images to verify images are indexed.
- **Rich Results Test:** Validate `VideoObject` schema at [search.google.com/test/rich-results](https://search.google.com/test/rich-results).
- **PageSpeed Insights:** Check image optimization scores and format recommendations.
- **Search Console:** Review the "Videos" and "Images" reports for indexing issues.

## Failure modes / debugging
| Problem | Cause | Fix |
|---|---|---|
| Images not appearing in Google Images | CSS background-image or images blocked by `robots.txt` | Use `<img>` tags; allow image URLs in robots.txt |
| Image layout shifts (CLS) | Missing `width`/`height` attributes | Add explicit `width` and `height` to all `<img>` tags |
| Video not showing in search results | Missing `VideoObject` schema or no thumbnail | Add `VideoObject` JSON-LD with `thumbnailUrl` |
| Large image file sizes hurting LCP | Uncompressed JPEG/PNG, no modern formats | Convert to WebP/AVIF, compress, and use responsive images |
| Alt text missing | Developer oversight | Add descriptive `alt` to every `<img>` |

## Escalation
- If images require a CDN or image transformation service (Cloudinary, Imgix), consult a DevOps engineer.
- If video hosting requires DRM or authentication, escalate to the video platform team.

### References
- [Google: Image SEO Best Practices](https://developers.google.com/search/docs/appearance/google-images)
- [Google: Video Best Practices](https://developers.google.com/search/docs/appearance/video)
- [Google: VideoObject Structured Data](https://developers.google.com/search/docs/appearance/structured-data/video)
