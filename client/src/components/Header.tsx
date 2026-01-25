import { useState } from "react";
import { Link } from "wouter";
import { Search, Bell, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { MobileNav } from "@/components/MobileNav";
import { ThemeToggle } from "@/components/ThemeToggle";

interface HeaderProps {
  onSearchClick?: () => void;
}

export function Header({ onSearchClick }: HeaderProps) {
  const { t } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border transition-all duration-300">
        <div className="flex items-center justify-between px-4 md:px-12 h-16">
          <div className="flex items-center gap-4 md:gap-8">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setMobileNavOpen(true)}
              data-testid="button-hamburger"
              className="lg:hidden hover-elevate active-elevate-2 min-h-[44px] min-w-[44px]"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Link href="/">
              <span
                className="text-xl md:text-2xl font-bold tracking-tight cursor-pointer"
                data-testid="link-home"
              >
                <span className="text-foreground">nisam</span>
                <span className="text-primary">.video</span>
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-6">
              <Link href="/">
                <span
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                  data-testid="link-browse"
                >
                  {t("nav.browse")}
                </span>
              </Link>
              <Link href="/categories">
                <span
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                  data-testid="link-categories"
                >
                  {t("nav.categories")}
                </span>
              </Link>
              <Link href="/tags">
                <span
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                  data-testid="link-tags"
                >
                  {t("nav.tags")}
                </span>
              </Link>
              <Link href="/popular">
                <span
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                  data-testid="link-popular"
                >
                  {t("nav.popular")}
                </span>
              </Link>
              <Link href="/shorts">
                <span
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                  data-testid="link-shorts"
                >
                  Shorts
                </span>
              </Link>
              <Link href="/about">
                <span
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                  data-testid="link-about"
                >
                  About
                </span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={onSearchClick}
              data-testid="button-search"
              className="hover-elevate active-elevate-2 min-h-[44px] min-w-[44px]"
            >
              <Search className="h-5 w-5" />
            </Button>

            <ThemeToggle />

            <Button
              size="icon"
              variant="ghost"
              data-testid="button-notifications"
              className="hidden md:flex hover-elevate active-elevate-2 min-h-[44px] min-w-[44px]"
            >
              <Bell className="h-5 w-5" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              data-testid="button-profile"
              className="hover-elevate active-elevate-2 min-h-[44px] min-w-[44px]"
            >
              <User className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
    </>
  );
}
