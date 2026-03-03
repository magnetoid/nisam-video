import { useState } from "react";
import { Link } from "wouter";
import { Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { MobileNav } from "@/components/MobileNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { UserMenu } from "@/components/UserMenu";
import { InstallPrompt } from "@/components/InstallPrompt";

interface HeaderProps {
  onSearchClick?: () => void;
  onMenuClick?: () => void;
}

export function Header({ onSearchClick, onMenuClick }: HeaderProps) {
  const { t } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleMenuClick = () => {
    if (onMenuClick) {
      onMenuClick();
    } else {
      setMobileNavOpen(true);
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border transition-all duration-300">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-12 h-16">
          <div className="flex items-center gap-3 sm:gap-4 md:gap-8">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleMenuClick}
              data-testid="button-hamburger"
              className="md:hidden hover-elevate active-elevate-2 min-h-[44px] min-w-[44px]"
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

            <div className="md:hidden">
              <Link href="/channels">
                <span
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                  data-testid="link-channels-mobile-top"
                >
                  {t("nav.channels")}
                </span>
              </Link>
            </div>

            <nav className="hidden md:flex items-center gap-6">
              <Link href="/channels">
                <span
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                  data-testid="link-channels"
                >
                  {t("nav.channels")}
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
            
            <div className="hidden md:flex">
              <NotificationsDropdown />
            </div>

            <UserMenu />
          </div>
        </div>
      </header>

      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <InstallPrompt />
    </>
  );
}
