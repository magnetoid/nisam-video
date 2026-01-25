import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Home, Grid3x3, Tags, TrendingUp, Settings, Smartphone } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  const { t } = useTranslation();

  const navItems = [
    {
      href: "/",
      label: t("nav.browse"),
      icon: Home,
      testId: "link-mobile-browse",
    },
    {
      href: "/categories",
      label: t("nav.categories"),
      icon: Grid3x3,
      testId: "link-mobile-categories",
    },
    {
      href: "/tags",
      label: t("nav.tags"),
      icon: Tags,
      testId: "link-mobile-tags",
    },
    {
      href: "/popular",
      label: t("nav.popular"),
      icon: TrendingUp,
      testId: "link-mobile-popular",
    },
    {
      href: "/shorts",
      label: "Shorts",
      icon: Smartphone,
      testId: "link-mobile-shorts",
    },
    {
      href: "/admin",
      label: t("nav.admin"),
      icon: Settings,
      testId: "link-mobile-admin",
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="left"
        className="w-[280px] sm:w-[320px]"
        data-testid="mobile-nav-sheet"
      >
        <SheetHeader>
          <SheetTitle>
            <Link href="/" onClick={onClose}>
              <span className="text-2xl font-bold tracking-tight cursor-pointer">
                <span className="text-foreground">nisam</span>
                <span className="text-primary">.video</span>
              </span>
            </Link>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-2 mt-8" data-testid="mobile-nav-menu">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={onClose}>
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-md hover-elevate active-elevate-2 cursor-pointer"
                data-testid={item.testId}
              >
                <item.icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-base font-medium">{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
