import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { VideoGrid } from "@/components/VideoGrid";
import { SEO } from "@/components/SEO";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import type { LocalizedCategory, VideoWithLocalizedRelations, SupportedLanguage, SeoSettings } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

const LANGUAGE_CODES = ['en', 'sr', 'sr-latn', 'sr-cyrl', 'bs', 'hr', 'me'];

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation ? useLocation() : [null, null];

  // Guard: if slug looks like a language code, it means routing mismatch - go home
  if (slug && LANGUAGE_CODES.includes(slug.toLowerCase())) {
    if (typeof window !== 'undefined') window.location.href = '/';
    return null;
  }

  // Fetch specific category by slug with language
  const { data: category, isLoading: isCategoryLoading } = useQuery<LocalizedCategory>({
    queryKey: [`/api/categories/${slug}`, i18n.language],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/categories/${slug}?lang=${i18n.language}`);
      return res.json();
    },
    enabled: !!slug && !LANGUAGE_CODES.includes((slug || '').toLowerCase())
  });

  const { data: videos, isLoading: isVideosLoading } = useQuery<VideoWithLocalizedRelations[]>({
    queryKey: [`/api/videos`, category?.id, i18n.language],
    queryFn: async () => {
       const res = await apiRequest("GET", `/api/videos?categoryId=${category?.id}&lang=${i18n.language}`);
       return res.json();
    },
    enabled: !!category?.id,
  });

  if (isCategoryLoading) return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center">{t("common.loading", "Loading...")}</div>
      <Footer />
    </div>
  );

  if (!category) return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center">{t("categories.notFound", "Category not found")}</div>
      <Footer />
    </div>
  );

  const { data: languages = [] } = useQuery<SupportedLanguage[]>({
    queryKey: ["/api/languages"],
    staleTime: Infinity,
  });

  const { data: seoSettings } = useQuery<SeoSettings>({
    queryKey: ["/api/seo/settings"],
  });
  const siteName = seoSettings?.siteName || "";

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const currentLang = languages.find(l => l.code === i18n.language);
  const currentPrefix = currentLang?.isDefault ? "" : `/${i18n.language}`;
  const effectivePrefix = currentLang ? currentPrefix : (i18n.language === "en" ? "/en" : "");
  const currentUrl = `${origin}${effectivePrefix}/category/${slug}`;

  const hreflangLinks = [
    ...languages.map(lang => {
      const prefix = lang.isDefault ? "" : `/${lang.code}`;
      return { lang: lang.code, url: `${origin}${prefix}/category/${slug}` };
    }),
    { lang: "x-default", url: `${origin}/category/${slug}` },
  ];

  const categoryStructuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: category.name,
        description: category.description || (siteName
          ? `Browse ${category.name} videos on ${siteName}`
          : `Browse ${category.name} videos`),
        url: currentUrl,
        numberOfItems: videos?.length ?? 0,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: origin },
          { "@type": "ListItem", position: 2, name: "Categories", item: `${origin}/categories` },
          { "@type": "ListItem", position: 3, name: category.name, item: currentUrl },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={category.name}
        description={category.description || (siteName
          ? `Browse the best ${category.name} videos on ${siteName}. Curated and categorized by AI.`
          : `Browse the best ${category.name} videos. Curated and categorized by AI.`)}
        canonical={currentUrl}
        hreflang={hreflangLinks}
        structuredData={categoryStructuredData}
      />
      <Header />
      <main id="main-content" className="flex-1 container mx-auto px-4 py-8 pt-24">
        <PageBreadcrumb items={[
          { label: t("nav.categories", "Categories"), href: "/categories" },
          { label: category.name },
        ]} />
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{category.name}</h1>
          {category.description && (
            <p className="text-muted-foreground">{category.description}</p>
          )}
        </div>
        <VideoGrid videos={videos || []} isLoading={isVideosLoading} />
      </main>
      <Footer />
    </div>
  );
}
