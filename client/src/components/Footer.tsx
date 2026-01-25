import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer
      className="bg-card border-t border-border mt-auto"
      data-testid="footer"
    >
      <div className="px-4 md:px-12 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <Link href="/">
              <span
                className="text-xl font-bold tracking-tight cursor-pointer"
                data-testid="link-footer-logo"
              >
                <span className="text-foreground">nisam</span>
                <span className="text-primary">.video</span>
              </span>
            </Link>

            <nav className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
              <Link href="/">
                <span
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  data-testid="link-footer-browse"
                >
                  {t("nav.browse")}
                </span>
              </Link>
              <Link href="/categories">
                <span
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  data-testid="link-footer-categories"
                >
                  {t("nav.categories")}
                </span>
              </Link>
              <Link href="/tags">
                <span
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  data-testid="link-footer-tags"
                >
                  {t("nav.tags")}
                </span>
              </Link>
              <Link href="/popular">
                <span
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  data-testid="link-footer-popular"
                >
                  {t("nav.popular")}
                </span>
              </Link>
              <Link href="/donate">
                <span
                  className="text-sm text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer"
                  data-testid="link-footer-donate"
                >
                  ❤️ {t("nav.donate")}
                </span>
              </Link>
              <Link href="/admin">
                <span
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  data-testid="link-footer-admin"
                >
                  {t("nav.admin")}
                </span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSwitcher />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border text-center">
          <p
            className="text-sm text-muted-foreground"
            data-testid="text-copyright"
          >
            © {new Date().getFullYear()} nisam.video.{" "}
            {t("footer.rights", "All rights reserved.")}
          </p>
        </div>
      </div>
    </footer>
  );
}
