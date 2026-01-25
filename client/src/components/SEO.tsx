import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SeoSettings } from "@shared/schema";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  path?: string;
  type?: string;
  structuredData?: object;
  canonical?: string;
  hreflang?: { lang: string; url: string }[];
  publishedTime?: string;
  modifiedTime?: string;
}

export function SEO({
  title: pageTitle,
  description: pageDescription,
  image: pageImage,
  path = "",
  type = "website",
  structuredData,
  canonical,
  hreflang = [],
  publishedTime,
  modifiedTime,
}: SEOProps) {
  const { data: settings } = useQuery<SeoSettings>({
    queryKey: ["/api/seo/settings"],
  });

  useEffect(() => {
    if (!settings) return;

    // Construct full title
    const fullTitle = pageTitle
      ? `${pageTitle} | ${settings.siteName}`
      : settings.siteName;

    // Use page description or fallback to site description
    const description = pageDescription || settings.siteDescription;

    // Use page image or fallback to OG image
    const image = pageImage || settings.ogImage || "";

    // Full URL
    const url = `${window.location.origin}${path}`;

    // Update document title
    document.title = fullTitle;

    // Update or create meta tags, or remove if content is empty
    const updateMetaTag = (
      name: string,
      content: string,
      isProperty = false,
    ) => {
      const attr = isProperty ? "property" : "name";
      let element = document.querySelector(`meta[${attr}="${name}"]`);

      if (!content) {
        // Remove tag if content is empty
        if (element) {
          element.remove();
        }
        return;
      }

      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attr, name);
        document.head.appendChild(element);
      }

      element.setAttribute("content", content);
    };

    // Standard meta tags
    updateMetaTag("description", description);
    updateMetaTag("keywords", settings.metaKeywords || "");

    // Open Graph tags
    updateMetaTag("og:title", fullTitle, true);
    updateMetaTag("og:description", description, true);
    updateMetaTag("og:type", type, true);
    updateMetaTag("og:url", url, true);
    updateMetaTag("og:site_name", settings.siteName, true);
    updateMetaTag("og:image", image, true);

    // Twitter Card tags
    updateMetaTag("twitter:card", image ? "summary_large_image" : "");
    updateMetaTag("twitter:title", fullTitle);
    updateMetaTag("twitter:description", description);
    updateMetaTag("twitter:image", image);

    // Article meta tags (for videos and blog-like content)
    if (publishedTime) {
      updateMetaTag("article:published_time", publishedTime, true);
    }
    if (modifiedTime) {
      updateMetaTag("article:modified_time", modifiedTime, true);
    }

    // Canonical URL
    const updateLinkTag = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`);

      if (!href) {
        if (element) element.remove();
        return;
      }

      if (!element) {
        element = document.createElement("link");
        element.setAttribute("rel", rel);
        document.head.appendChild(element);
      }

      element.setAttribute("href", href);
    };

    const canonicalUrl = canonical || url;
    updateLinkTag("canonical", canonicalUrl);

    // Hreflang tags for multi-language support
    // Remove existing hreflang tags
    document
      .querySelectorAll('link[rel="alternate"][hreflang]')
      .forEach((el) => el.remove());

    // Add new hreflang tags
    hreflang.forEach(({ lang, url: langUrl }) => {
      const linkEl = document.createElement("link");
      linkEl.setAttribute("rel", "alternate");
      linkEl.setAttribute("hreflang", lang);
      linkEl.setAttribute("href", langUrl);
      document.head.appendChild(linkEl);
    });

    // Structured Data (JSON-LD)
    const removeStructuredData = () => {
      const existing = document.querySelector(
        'script[type="application/ld+json"]',
      );
      if (existing) existing.remove();
    };

    removeStructuredData();

    if (structuredData) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }, [
    settings,
    pageTitle,
    pageDescription,
    pageImage,
    path,
    type,
    structuredData,
    canonical,
    hreflang,
    publishedTime,
    modifiedTime,
  ]);

  return null;
}
