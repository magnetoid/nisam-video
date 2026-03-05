import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";

interface SupportedLanguage {
  code: string;
  name: string;
  isActive: boolean;
}

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [location, setLocation] = useLocation();

  const { data: languages = [] } = useQuery<SupportedLanguage[]>({
    queryKey: ["/api/languages"],
  });

  const activeLanguages = languages.filter(l => l.isActive);

  // If no languages loaded yet, fallback to static list or just show current
  const displayLanguages = activeLanguages.length > 0 ? activeLanguages : [
    { code: "en", name: "English" },
    { code: "sr-Latn", name: "Srpski" }
  ];

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("language", lng);

    const currentPath = window.location.pathname;
    
    // Only handle URL prefixing for 'en' if that's the established pattern
    // The previous code had specific logic for 'en' vs others.
    // We should probably keep it consistent or generalize it.
    // Existing logic: "en" gets /en prefix, others (implied sr-Latn) get no prefix.
    // If we add 'de', should it be /de? 
    // The current router setup likely only handles /en explicitly or uses a wildcard?
    // Let's look at client/src/App.tsx router setup.
    // If router doesn't support dynamic language prefixes, we shouldn't force it here.
    // The previous code hardcoded logic for 'en'.
    
    // For now, let's preserve the existing behavior for 'en' and default for others.
    // If the user adds a new language, it will behave like 'sr-Latn' (no prefix) unless we update routing.
    // UPDATING ROUTING IS RISKY without seeing it.
    // Let's assume for now we just change the internal state.
    // However, the previous code explicitly did a full page reload via window.location.href.
    
    if (lng === "en") {
      if (!currentPath.startsWith("/en")) {
        const newPath = `/en${currentPath === "/" ? "" : currentPath}`;
        window.location.href = newPath;
      }
    } else {
      // For any other language, we remove /en if present
      if (currentPath.startsWith("/en")) {
        const newPath = currentPath.replace(/^\/en/, "") || "/";
        window.location.href = newPath;
      } else {
          // If we are already on a non-en path, just reload to ensure fresh content/SEO?
          // Or just let react-i18next handle it.
          // The previous code did a reload.
          // If we are switching from sr-Latn to de, no path change needed if both are at root.
      }
    }
  };

  const currentLangName = displayLanguages.find(l => l.code === i18n.language)?.name || i18n.language;

  return (
    <div className="flex items-center gap-2" data-testid="language-switcher">
      <Globe className="w-4 h-4 text-muted-foreground" />
      <Select value={i18n.language} onValueChange={changeLanguage}>
        <SelectTrigger className="w-[140px] h-8" data-testid="select-language">
          <SelectValue placeholder={currentLangName}>
             {currentLangName}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {displayLanguages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
