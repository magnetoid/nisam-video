import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { RecommendChannelDialog } from "@/components/RecommendChannelDialog";
import type { LocalizedCategory } from "@shared/schema";

export function Footer() {
  const { t, i18n } = useTranslation();

  const { data: categories = [] } = useQuery<LocalizedCategory[]>({
    queryKey: ["/api/categories", i18n.language],
    staleTime: 30 * 60 * 1000,
  });

  const topCategories = categories.slice(0, 6);

  return (
    <footer className="bg-card border-t border-border mt-auto" data-testid="footer">
      <div className="px-4 md:px-12 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <Link href="/">
              <span className="text-xl font-bold tracking-tight cursor-pointer" data-testid="link-footer-logo">
                <span className="text-foreground">nisam</span>
                <span className="text-primary">.video</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground">
              {t("footer.tagline", "AI-powered video aggregation platform. Discover the best content from YouTube and TikTok.")}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a href="https://x.com/nisamvideo" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://github.com/magnetoid/nisam-video" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
              </a>
            </div>
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
            © {new Date().getFullYear()} nisam.video. {t("footer.rights", "All rights reserved.")}
          </p>
        </div>
      </div>
    </footer>
  );
}
