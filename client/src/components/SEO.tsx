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
  title,
  description,
  image,
  type = "website",
  publishedTime,
  modifiedTime,
}: SEOProps) {
  const { t } = useTranslation();
  const settings = useSeoSettings();
  const router = useRouter();
  const currentPath = router.asPath;
  const fullTitle = title ? `${title} | ${settings?.siteName || "nisam.video"}` : settings?.siteName || "nisam.video";
  const url = `https://nisam.video${currentPath}`;

  const { data: seoMeta } = useQuery({
    queryKey: ['seo-meta', currentPath],
    queryFn: () => apiRequest('GET', `/api/seo/meta-tags?pageUrl=${encodeURIComponent(currentPath)}`),
    staleTime: 5 * 60 * 1000, // 5min
  });

  useEffect(() => {
    const meta = seoMeta?.[0] || {};
    const effectiveTitle = meta.title || title || settings?.siteName || "nisam.video";
    const effectiveDesc = meta.description || description;
    const effectiveImage = meta.ogImage || image;

    // Standard meta tags
    updateMetaTag("description", effectiveDesc);
    updateMetaTag("keywords", meta.keywords || settings?.metaKeywords || "");

    // Open Graph tags
    updateMetaTag("og:title", meta.ogTitle || effectiveTitle, true);
    updateMetaTag("og:description", meta.ogDescription || effectiveDesc, true);
    updateMetaTag("og:type", type, true);
    updateMetaTag("og:url", url, true);
    updateMetaTag("og:site_name", settings?.siteName, true);
    updateMetaTag("og:image", effectiveImage, true);

    // Twitter Card tags
    updateMetaTag("twitter:card", effectiveImage ? "summary_large_image" : "");
    updateMetaTag("twitter:title", meta.twitterTitle || effectiveTitle);
    updateMetaTag("twitter:description", meta.twitterDescription || effectiveDesc);
    updateMetaTag("twitter:image", meta.twitterImage || effectiveImage);

    // Canonical
    if (meta.canonicalUrl) updateMetaTag("link[rel='canonical']", meta.canonicalUrl, true, 'href');

    // Schema markup
    if (meta.schemaMarkup) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify(meta.schemaMarkup);
      document.head.appendChild(script);
    }

    // Article meta tags (for videos and blog-like content)
    if (publishedTime) {
      updateMetaTag("article:published_time", publishedTime, true);
    }
    if (modifiedTime) {
      updateMetaTag("article:modified_time", modifiedTime, true);
    }
  }, [title, description, image, type, publishedTime, modifiedTime, settings, currentPath, seoMeta]);

  return null;
}
