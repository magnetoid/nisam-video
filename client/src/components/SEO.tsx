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
  path?: string;
  type?: string;
  structuredData?: object;
  canonical?: string;
  hreflang?: { lang: string; url: string }[];
  publishedTime?: string;
  modifiedTime?: string;
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
  type = "website",
  publishedTime,
  modifiedTime,
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
    updateMetaTag("og:image", effectiveImage, true);

    // Twitter Card tags
    updateMetaTag("twitter:card", effectiveImage ? "summary_large_image" : "summary");
    updateMetaTag("twitter:title", meta.twitterTitle || effectiveTitle);
    updateMetaTag("twitter:description", meta.twitterDescription || effectiveDesc);
    updateMetaTag("twitter:image", meta.twitterImage || effectiveImage);

    // Canonical
    if (meta.canonicalUrl) {
      let link = document.querySelector("link[rel='canonical']");
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', meta.canonicalUrl);
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
  }, [title, description, image, type, publishedTime, modifiedTime, settings, currentPath, seoMeta, fullTitle, url]);

  return null;
}
