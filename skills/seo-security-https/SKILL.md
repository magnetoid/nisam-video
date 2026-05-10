---
title: SEO Security & HTTPS
description: HTTPS enforcement, security headers, Safe Browsing compliance, and mobile-first indexing requirements for SEO.
version: 1.0.0
---

# SEO: Security, HTTPS & Mobile-First Indexing

## When to use
Use this skill when:
- Setting up a new website or migrating from HTTP to HTTPS.
- Configuring server security headers.
- Ensuring mobile-first indexing compliance.
- Implementing responsive design for SEO.
- Handling intrusive interstitials or popups.
- Addressing Safe Browsing warnings.

## Inputs required
- The current protocol (HTTP vs HTTPS).
- The server/hosting platform (Vercel, Netlify, AWS, Apache, Nginx, etc.).
- Whether the site is mobile-responsive or has a separate mobile version.
- Any popups, interstitials, or consent banners in use.

## Procedure

### 1. HTTPS — Required for SEO
HTTPS is a confirmed Google ranking signal and part of the Page Experience evaluation.

- **Every page MUST be served over HTTPS.**
- Redirect all HTTP URLs to HTTPS with a 301 redirect.
- Ensure SSL/TLS certificate is valid and not expired.
- Avoid mixed content (HTTP resources on HTTPS pages).

```nginx
# Nginx — Force HTTPS
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://example.com$request_uri;
}
```

```apache
# Apache .htaccess — Force HTTPS
RewriteEngine On
RewriteCond %{HTTPS} !=on
RewriteRule ^(.*)$ https://%{HTTP_HOST}/$1 [R=301,L]
```

### 2. Security Headers
Security headers protect users and signal trust to search engines.

```nginx
# Recommended security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

```html
<!-- Content Security Policy via meta tag (when server config isn't available) -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; img-src 'self' https:; script-src 'self' 'unsafe-inline'" />
```

| Header | Purpose |
|---|---|
| `Strict-Transport-Security` | Forces HTTPS for all future visits |
| `X-Content-Type-Options: nosniff` | Prevents MIME-type sniffing |
| `X-Frame-Options: SAMEORIGIN` | Prevents clickjacking |
| `Referrer-Policy` | Controls referrer information sent |

### 3. Mobile-First Indexing
Google predominantly uses the **mobile version** of a site for indexing and ranking.

- **Use responsive design** — one URL for all devices.
- Set the viewport meta tag on every page.
- Ensure content parity between mobile and desktop.
- Don't hide content behind tabs, accordions, or expandable sections on mobile if you want it indexed.

```html
<!-- Required viewport meta tag -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

```css
/* Responsive design fundamentals */
img, video, iframe {
  max-width: 100%;
  height: auto;
}

/* Use CSS media queries for layout adaptation */
@media (max-width: 768px) {
  .sidebar { display: none; }  /* Be careful — hidden content may not be indexed */
  .nav-menu { /* mobile menu styles */ }
}
```

> **Critical:** If content is hidden via CSS `display: none` or `visibility: hidden` on the mobile version, Google may not index it. Ensure all important content is visible on mobile.

### 4. Intrusive Interstitials (Popups)
Google penalizes pages with intrusive interstitials that block content on mobile.

#### ❌ Penalized patterns:
- Full-screen popups that must be dismissed before accessing content
- Standalone interstitials that users must dismiss before reaching the page
- Above-the-fold layout where the interstitial occupies the entire viewport

#### ✅ Acceptable patterns:
- Cookie consent banners (legally required)
- Login dialogs for gated content (paywalls)
- Small banners that use a reasonable amount of screen space
- Age verification interstitials (legally required)

```html
<!-- ✅ Acceptable — Small banner, doesn't block content -->
<div class="cookie-banner" style="position: fixed; bottom: 0; padding: 12px;">
  <p>We use cookies to improve your experience.
    <button onclick="acceptCookies()">Accept</button>
  </p>
</div>

<!-- ❌ Penalized — Full-screen overlay blocking content -->
<div class="modal-overlay" style="position: fixed; inset: 0; z-index: 9999;">
  <div class="modal">
    <h2>Subscribe to our newsletter!</h2>
    <button onclick="closeModal()">No thanks</button>
  </div>
</div>
```

### 5. Page Experience Signals (Holistic)
Google evaluates page experience as a combination of signals:

| Signal | Requirement |
|---|---|
| **Core Web Vitals** | LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms |
| **HTTPS** | Page served over HTTPS |
| **Mobile-friendly** | Responsive design with viewport meta |
| **No intrusive interstitials** | Content not blocked by popups |
| **Safe Browsing** | No malware, phishing, or deceptive content |

> **Google states:** "We highly recommend ensuring your site provides a good page experience. There is no single page experience signal that alone will guarantee a top ranking position."

### 6. Safe Browsing Compliance
Google Safe Browsing protects users from dangerous sites. If flagged:
- Your site may show warnings in Chrome and search results.
- Rankings will be severely impacted.

**Prevention:**
- Keep CMS and plugins updated.
- Use strong passwords and 2FA.
- Monitor Google Search Console for Security Issues.
- Scan for malware regularly.
- Don't link to known malicious sites.

### 7. Canonical HTTPS + www Handling
Choose ONE canonical version and redirect all others:

```
# Pick one canonical URL format:
https://example.com        ← preferred (no www)
https://www.example.com    ← alternative

# Redirect all variants:
http://example.com         → 301 → https://example.com
http://www.example.com     → 301 → https://example.com
https://www.example.com    → 301 → https://example.com
```

## Verification
- **SSL check:** Use [SSL Labs](https://www.ssllabs.com/ssltest/) to grade your HTTPS implementation.
- **Security headers:** Use [securityheaders.com](https://securityheaders.com/) to verify headers.
- **Mobile-friendly test:** Use [Google's Mobile-Friendly Test](https://search.google.com/test/mobile-friendly) or the URL Inspection tool.
- **Safe Browsing:** Check [Google Safe Browsing](https://transparencyreport.google.com/safe-browsing/search) status.
- **Mixed content:** Use Chrome DevTools Console to check for mixed content warnings.
- **Search Console:** Review Page Experience report for holistic scoring.

## Failure modes / debugging
| Problem | Cause | Fix |
|---|---|---|
| "Not Secure" warning in browser | HTTP served, no SSL certificate | Install SSL certificate; redirect HTTP → HTTPS |
| Mixed content warnings | HTTP resources (images, scripts) on HTTPS page | Update all resource URLs to HTTPS |
| Mobile usability errors in GSC | Missing viewport meta, too-small tap targets | Add viewport meta, increase button/link sizes to 48px minimum |
| Rankings dropped after popup | Full-screen interstitial penalized | Replace with small banner or remove interstitial |
| Safe Browsing warning | Malware or phishing detected | Clean infected files, request review in Search Console |
| Content not indexed (mobile) | Content hidden on mobile version | Ensure all SEO-critical content is visible on mobile |

## Escalation
- If HTTPS migration involves complex redirect maps (hundreds of URLs), consult a DevOps engineer and SEO specialist.
- If Safe Browsing flags persist after cleanup, consult a security specialist and submit a review via Search Console.
- If the site requires separate mobile URLs (m.example.com), consult an SEO engineer for `rel="alternate"` and `rel="canonical"` setup.

### References
- [Google: Page experience](https://developers.google.com/search/docs/appearance/page-experience)
- [Google: Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals)
- [Google: Interstitials and dialogs](https://developers.google.com/search/docs/appearance/avoid-intrusive-interstitials)
- [Google: Mobile-first indexing](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing)
- [Google: Technical requirements](https://developers.google.com/search/docs/essentials/technical)
