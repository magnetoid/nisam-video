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

function updateMetaTag(name: string, content: string | undefined, isProperty: boolean = false, contentAttr: string = 'content') {
  if (!content) return;
  
  const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let element = document.querySelector(selector);
  
  if (!element) {
    element = document.createElement('meta');
    if (isProperty) {
      element.setAttribute('property', name);
    } else {
      element.setAttribute('name', name);
    }
    document.head.appendChild(element);
  }
  
  element.setAttribute(contentAttr, content);
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
  const { t } = useTranslation();
  const [location] = useLocation();
  const currentPath = location;
  
  const { data: settings } = useQuery<SeoSettings>({ 
    queryKey: ["/api/seo/settings"] 
  });

  const fullTitle = title ? `${title} | ${settings?.siteName || "nisam.video"}` : settings?.siteName || "nisam.video";
  const url = `https://nisam.video${currentPath}`;

  const { data: seoMeta } = useQuery({
    queryKey: ['seo-meta', currentPath],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/seo/meta-tags?pageUrl=${encodeURIComponent(currentPath)}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5min
  });

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    const meta = seoMeta?.[0] || {};
    const effectiveTitle = meta.title || title || settings?.siteName || "nisam.video";
    const effectiveDesc = meta.description || description || settings?.siteDescription || "";
    const effectiveImage = meta.ogImage || image || settings?.ogImage || "";

    // Standard meta tags
    updateMetaTag("description", effectiveDesc);
    updateMetaTag("keywords", meta.keywords || settings?.metaKeywords || "");

    // Open Graph tags
    updateMetaTag("og:title", meta.ogTitle || effectiveTitle, true);
    updateMetaTag("og:description", meta.ogDescription || effectiveDesc, true);
    updateMetaTag("og:type", type, true);
    updateMetaTag("og:url", url, true);
    updateMetaTag("og:site_name", settings?.siteName || "nisam.video", true);
    updateMetaTag("og:locale", document.documentElement.lang === "sr" ? "sr_RS" : "en_US", true);
    if (effectiveImage) {
      updateMetaTag("og:image", effectiveImage, true);
      updateMetaTag("og:image:secure_url", effectiveImage.startsWith("https") ? effectiveImage : effectiveImage, true);
      updateMetaTag("og:image:width", imageWidth, true);
      updateMetaTag("og:image:height", imageHeight, true);
      updateMetaTag("og:image:alt", imageAlt || effectiveTitle, true);
    }

    // og:video tags for video pages
    if (videoUrl) {
      updateMetaTag("og:video", videoUrl, true);
      updateMetaTag("og:video:secure_url", videoSecureUrl || videoUrl, true);
      updateMetaTag("og:video:type", "text/html", true);
      updateMetaTag("og:video:width", videoWidth, true);
      updateMetaTag("og:video:height", videoHeight, true);
      if (videoDuration) updateMetaTag("og:video:duration", String(videoDuration), true);
    }

    // Twitter Card tags
    const twitterHandle = settings?.twitterHandle || "@nisamvideo";
    updateMetaTag("twitter:card", effectiveImage ? "summary_large_image" : "summary");
    updateMetaTag("twitter:site", twitterHandle);
    updateMetaTag("twitter:creator", twitterHandle);
    updateMetaTag("twitter:title", meta.twitterTitle || effectiveTitle);
    updateMetaTag("twitter:description", meta.twitterDescription || effectiveDesc);
    updateMetaTag("twitter:image", meta.twitterImage || effectiveImage);
    if (imageAlt || effectiveTitle) updateMetaTag("twitter:image:alt", imageAlt || effectiveTitle);

    // Canonical
    const effectiveCanonical = meta.canonicalUrl || canonical;
    if (effectiveCanonical) {
      let link = document.querySelector("link[rel='canonical']");
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', effectiveCanonical);
    }

    // Hreflang
    if (hreflang && hreflang.length > 0) {
      hreflang.forEach(({ lang, url }) => {
        let link = document.querySelector(`link[rel='alternate'][hreflang='${lang}']`);
        if (!link) {
          link = document.createElement('link');
          link.setAttribute('rel', 'alternate');
          link.setAttribute('hreflang', lang);
          document.head.appendChild(link);
        }
        link.setAttribute('href', url);
      });
    }

    // Schema markup
    const effectiveSchema = meta.schemaMarkup || structuredData;
    if (effectiveSchema) {
      let script = document.querySelector("#seo-schema-script");
      if (!script) {
        script = document.createElement('script');
        script.id = "seo-schema-script";
        script.setAttribute('type', 'application/ld+json');
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(effectiveSchema);
    }

    // Article meta tags (for videos and blog-like content)
    if (publishedTime) {
      updateMetaTag("article:published_time", publishedTime, true);
    }
    if (modifiedTime) {
      updateMetaTag("article:modified_time", modifiedTime, true);
    }
  }, [title, description, image, imageAlt, imageWidth, imageHeight, type, publishedTime, modifiedTime, settings, currentPath, seoMeta, fullTitle, url, structuredData, canonical, hreflang, videoUrl, videoSecureUrl, videoDuration, videoWidth, videoHeight]);

  return null;
}
