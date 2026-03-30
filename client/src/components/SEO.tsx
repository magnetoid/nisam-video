import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { SeoSettings } from "@shared/schema";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: string;
  imageHeight?: string;
  path?: string;
  type?: string;
  structuredData?: object;
  canonical?: string;
  hreflang?: { lang: string; url: string }[];
  publishedTime?: string;
  modifiedTime?: string;
  videoUrl?: string;
  videoSecureUrl?: string;
  videoDuration?: number;
  videoWidth?: string;
  videoHeight?: string;
}

// Track dynamically added elements so we can clean them up on navigation
const dynamicElements: Set<Element> = new Set();

function cleanupDynamicTags() {
  dynamicElements.forEach(el => el.remove());
  dynamicElements.clear();
}

function setOrCreateMeta(name: string, content: string, isProperty: boolean = false): void {
  const attr = isProperty ? "property" : "name";
  const selector = `meta[${attr}="${name}"]`;
  let element = document.querySelector(selector);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attr, name);
    document.head.appendChild(element);
    dynamicElements.add(element);
  }

  element.setAttribute("content", content);
}

function setOrCreateLink(rel: string, href: string, attrs?: Record<string, string>): void {
  const extraSelector = attrs
    ? Object.entries(attrs).map(([k, v]) => `[${k}="${v}"]`).join("")
    : "";
  const selector = `link[rel="${rel}"]${extraSelector}`;
  let element = document.querySelector(selector);

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => element!.setAttribute(k, v));
    document.head.appendChild(element);
    dynamicElements.add(element);
  }

  element.setAttribute("href", href);
}

export function SEO({
  title,
  description,
  image,
  imageAlt,
  imageWidth = "1280",
  imageHeight = "720",
  type = "website",
  structuredData,
  canonical,
  hreflang,
  publishedTime,
  modifiedTime,
  videoUrl,
  videoSecureUrl,
  videoDuration,
  videoWidth = "1280",
  videoHeight = "720",
}: SEOProps) {
  const { t, i18n } = useTranslation();
  const [location] = useLocation();
  const currentPath = location;

  const { data: settings } = useQuery<SeoSettings>({
    queryKey: ["/api/seo/settings"],
  });

  const fullTitle = title ? `${title} | ${settings?.siteName || "nisam.video"}` : settings?.siteName || "nisam.video";
  const url = `https://nisam.video${currentPath}`;

  const { data: seoMeta } = useQuery({
    queryKey: ["seo-meta", currentPath],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/seo/meta-tags?pageUrl=${encodeURIComponent(currentPath)}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    // Clean up all dynamically added tags from previous page
    cleanupDynamicTags();

    // Update document title
    document.title = fullTitle;

    const meta = seoMeta?.[0] || {};
    const effectiveTitle = meta.title || title || settings?.siteName || "nisam.video";
    const effectiveDesc = meta.description || description || settings?.siteDescription || "";
    const effectiveImage = meta.ogImage || image || settings?.ogImage || "";

    // Standard meta tags
    setOrCreateMeta("description", effectiveDesc);
    if (meta.keywords || settings?.metaKeywords) {
      setOrCreateMeta("keywords", meta.keywords || settings?.metaKeywords || "");
    }

    // Open Graph tags
    setOrCreateMeta("og:title", meta.ogTitle || effectiveTitle, true);
    setOrCreateMeta("og:description", meta.ogDescription || effectiveDesc, true);
    setOrCreateMeta("og:type", type, true);
    setOrCreateMeta("og:url", url, true);
    setOrCreateMeta("og:site_name", settings?.siteName || "nisam.video", true);
    setOrCreateMeta("og:locale", document.documentElement.lang === "sr" ? "sr_RS" : "en_US", true);
    if (effectiveImage) {
      setOrCreateMeta("og:image", effectiveImage, true);
      setOrCreateMeta("og:image:secure_url", effectiveImage, true);
      setOrCreateMeta("og:image:width", imageWidth, true);
      setOrCreateMeta("og:image:height", imageHeight, true);
      setOrCreateMeta("og:image:alt", imageAlt || effectiveTitle, true);
    }

    // og:video tags (only on video pages)
    if (videoUrl) {
      setOrCreateMeta("og:video", videoUrl, true);
      setOrCreateMeta("og:video:secure_url", videoSecureUrl || videoUrl, true);
      setOrCreateMeta("og:video:type", "text/html", true);
      setOrCreateMeta("og:video:width", videoWidth, true);
      setOrCreateMeta("og:video:height", videoHeight, true);
      if (videoDuration) setOrCreateMeta("og:video:duration", String(videoDuration), true);
    }

    // Twitter Card tags
    const twitterHandle = settings?.twitterHandle || "@nisamvideo";
    setOrCreateMeta("twitter:card", effectiveImage ? "summary_large_image" : "summary");
    setOrCreateMeta("twitter:site", twitterHandle);
    setOrCreateMeta("twitter:creator", twitterHandle);
    setOrCreateMeta("twitter:title", meta.twitterTitle || effectiveTitle);
    setOrCreateMeta("twitter:description", meta.twitterDescription || effectiveDesc);
    if (meta.twitterImage || effectiveImage) {
      setOrCreateMeta("twitter:image", meta.twitterImage || effectiveImage);
    }
    if (imageAlt || effectiveTitle) setOrCreateMeta("twitter:image:alt", imageAlt || effectiveTitle);

    // Canonical
    const effectiveCanonical = meta.canonicalUrl || canonical;
    if (effectiveCanonical) {
      setOrCreateLink("canonical", effectiveCanonical);
    }

    // Hreflang
    if (hreflang && hreflang.length > 0) {
      hreflang.forEach(({ lang, url: hrefUrl }) => {
        setOrCreateLink("alternate", hrefUrl, { hreflang: lang });
      });
    }

    // Schema markup (JSON-LD)
    const effectiveSchema = meta.schemaMarkup || structuredData;
    if (effectiveSchema) {
      const script = document.createElement("script");
      script.id = "seo-schema-script";
      script.setAttribute("type", "application/ld+json");
      script.textContent = JSON.stringify(effectiveSchema);
      document.head.appendChild(script);
      dynamicElements.add(script);
    }

    // HTML lang attribute
    const currentLangCode = i18n.language === "sr-Latn" ? "sr" : i18n.language;
    if (document.documentElement.lang !== currentLangCode) {
      document.documentElement.setAttribute("lang", currentLangCode);
    }

    // Article meta tags
    if (publishedTime) setOrCreateMeta("article:published_time", publishedTime, true);
    if (modifiedTime) setOrCreateMeta("article:modified_time", modifiedTime, true);

    return () => {
      cleanupDynamicTags();
    };
  }, [title, description, image, imageAlt, imageWidth, imageHeight, type, publishedTime, modifiedTime, settings, currentPath, seoMeta, fullTitle, url, structuredData, canonical, hreflang, videoUrl, videoSecureUrl, videoDuration, videoWidth, videoHeight, i18n.language]);

  return null;
}
