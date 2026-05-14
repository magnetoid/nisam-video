import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { RecommendChannelDialog } from "@/components/RecommendChannelDialog";
import { SuggestFeatureDialog } from "@/components/SuggestFeatureDialog";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare, Mail, Github, Twitter, Facebook, Instagram, Youtube, Linkedin } from "lucide-react";
import type { LocalizedCategory, SeoSettings } from "@shared/schema";

const SOCIAL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  twitter: Twitter,
  x: Twitter,
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  linkedin: Linkedin,
  github: Github,
};

export function Footer() {
  const { t, i18n } = useTranslation();

  const { data: categories = [] } = useQuery<LocalizedCategory[]>({
    queryKey: ["footer-categories", i18n.language],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/categories?lang=${i18n.language}`);
      return res.json();
    },
    staleTime: 30 * 60 * 1000,
  });

  const { data: seoSettings } = useQuery<SeoSettings>({
    queryKey: ["/api/seo/settings"],
  });

  const socialLinks = (seoSettings?.socialLinks as Record<string, string> | undefined) || {};
  const socialEntries = Object.entries(socialLinks).filter(([, url]) => typeof url === "string" && url.trim().length > 0);

  const topCategories = categories.slice(0, 6);
  const siteName = seoSettings?.siteName || "";

  return (
    <footer className="bg-background border-t border-border/50 mt-auto" data-testid="footer">
      <div className="px-4 md:px-12 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <Link href="/">
              <span className="text-xl font-bold tracking-tight cursor-pointer" data-testid="link-footer-logo">
                {siteName || "nisam.video"}
              </span>
            </Link>
            <p className="text-sm text-muted-foreground">
              {t("footer.tagline", "Independent journalism platform. Diverse sources, one platform — supporting freedom of press.")}
            </p>
            {socialEntries.length > 0 && (
              <div className="flex items-center gap-3 pt-2">
                {socialEntries.map(([key, url]) => {
                  const Icon = SOCIAL_ICONS[key.toLowerCase()] || Github;
                  return (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={key}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
              {t("footer.explore", "Explore")}
            </h3>
            <nav className="flex flex-col gap-2">
              <Link href="/popular"><span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{t("nav.popular", "Popular")}</span></Link>
              <Link href="/channels"><span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{t("nav.channels", "Channels")}</span></Link>
              <Link href="/categories"><span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{t("nav.categories", "Categories")}</span></Link>
              <Link href="/tags"><span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{t("nav.tags", "Tags")}</span></Link>
              <Link href="/shorts"><span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{t("nav.shorts", "Shorts")}</span></Link>
              <RecommendChannelDialog>
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{t("footer.recommendChannel", "Recommend Channel")}</span>
              </RecommendChannelDialog>
            </nav>
          </div>

          {/* Top Categories */}
          {topCategories.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
                {t("footer.topCategories", "Top Categories")}
              </h3>
              <nav className="flex flex-col gap-2">
                {topCategories.map(cat => (
                  <Link key={cat.id} href={`/category/${cat.slug || cat.id}`}>
                    <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{cat.name}</span>
                  </Link>
                ))}
              </nav>
            </div>
          )}

          {/* Info */}
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
              {t("footer.info", "Info")}
            </h3>
            <nav className="flex flex-col gap-2">
              <Link href="/about"><span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{t("nav.about", "About")}</span></Link>
              <Link href="/faq"><span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{t("nav.faq", "FAQ")}</span></Link>
              <Link href="/donate"><span className="text-sm text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer">❤️ {t("nav.donate", "Donate")}</span></Link>
              <SuggestFeatureDialog>
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer inline-flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> {t("footer.suggestFeature", "Suggest Feature")}
                </span>
              </SuggestFeatureDialog>
              <SuggestFeatureDialog>
                <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> {t("footer.contactUs", "Contact Us")}
                </span>
              </SuggestFeatureDialog>
              <Link href="/privacy"><span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{t("nav.privacy", "Privacy Policy")}</span></Link>
              <Link href="/terms"><span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{t("nav.terms", "Terms of Service")}</span></Link>
            </nav>
            <div className="mt-4">
              <LanguageSwitcher />
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-sm text-muted-foreground" data-testid="text-copyright">
            © {new Date().getFullYear()}{siteName ? ` ${siteName}` : ""}. {t("footer.rights", "All rights reserved.")}
          </p>
        </div>
      </div>
    </footer>
  );
}
