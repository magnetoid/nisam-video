import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { VideoGrid } from "@/components/VideoGrid";
import type { VideoWithLocalizedRelations, SupportedLanguage, SeoSettings } from "@shared/schema";

export default function TagPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  // Simple slug to name conversion (replace hyphens with spaces)
  // This is a heuristic. Ideally tags should have slugs in DB.
  const tagName = slug ? decodeURIComponent(slug).replace(/-/g, " ") : "";

  const { data: videos, isLoading } = useQuery<VideoWithLocalizedRelations[]>({
    queryKey: [`/api/videos?tagName=${encodeURIComponent(tagName)}`],
    enabled: !!tagName,
  });

  const { data: languages = [] } = useQuery<SupportedLanguage[]>({
    queryKey: ["/api/languages"],
    staleTime: Infinity,
  });

  const { data: seoSettings } = useQuery<SeoSettings>({
    queryKey: ["/api/seo/settings"],
  });
  const siteName = seoSettings?.siteName || "";

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const tagSlug = slug || "";
  const currentLang = languages.find(l => l.code === i18n.language);
  const currentPrefix = currentLang?.isDefault ? "" : `/${i18n.language}`;
  const effectivePrefix = currentLang ? currentPrefix : (i18n.language === "en" ? "/en" : "");
  const canonicalUrl = `${origin}${effectivePrefix}/tag/${tagSlug}`;

  const hreflangLinks = languages.map(lang => {
    const prefix = lang.isDefault ? "" : `/${lang.code}`;
    return { lang: lang.code, url: `${origin}${prefix}/tag/${tagSlug}` };
  });
  hreflangLinks.push({ lang: "x-default", url: `${origin}/tag/${tagSlug}` });

  const pageTitle = t("tags.tagTitle", { tag: tagName, defaultValue: "Tag: {{tag}}" });
  const pageDescription = t("tags.tagDescription", {
    tag: tagName,
    site: siteName,
    count: videos?.length || 0,
    defaultValue: siteName
      ? `Browse videos tagged with "${tagName}" on ${siteName}. Discover AI-curated content about ${tagName}.`
      : `Browse videos tagged with "${tagName}". Discover AI-curated content about ${tagName}.`,
  });

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        ...(videos && videos.length > 0 && {
          numberOfItems: videos.length,
        }),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: origin },
          { "@type": "ListItem", position: 2, name: t("nav.tags", "Tags"), item: `${origin}/tags` },
          { "@type": "ListItem", position: 3, name: tagName, item: canonicalUrl },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={pageTitle}
        description={pageDescription}
        canonical={canonicalUrl}
        hreflang={hreflangLinks}
        structuredData={structuredData}
      />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 pt-24">
        <PageBreadcrumb items={[
          { label: t("nav.tags", "Tags"), href: "/tags" },
          { label: tagName },
        ]} />
        <h1 className="text-3xl font-bold mb-6 capitalize">
          {pageTitle}
        </h1>
        <VideoGrid videos={videos || []} isLoading={isLoading} />
      </main>
      <Footer />
    </div>
  );
}
