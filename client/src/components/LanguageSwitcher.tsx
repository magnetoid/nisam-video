import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [location, setLocation] = useLocation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("language", lng);

    const currentPath = window.location.pathname;

    if (lng === "en") {
      if (!currentPath.startsWith("/en")) {
        const newPath = `/en${currentPath === "/" ? "" : currentPath}`;
        window.location.href = newPath;
      }
    } else {
      if (currentPath.startsWith("/en")) {
        const newPath = currentPath.replace(/^\/en/, "") || "/";
        window.location.href = newPath;
      }
    }
  };

  return (
    <div className="flex items-center gap-2" data-testid="language-switcher">
      <Globe className="w-4 h-4 text-muted-foreground" />
      <Select value={i18n.language} onValueChange={changeLanguage}>
        <SelectTrigger className="w-[140px] h-8" data-testid="select-language">
          <SelectValue placeholder={i18n.language === "en" ? "English" : "Srpski"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sr-Latn" data-testid="option-serbian">
            Srpski
          </SelectItem>
          <SelectItem value="en" data-testid="option-english">
            English
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
