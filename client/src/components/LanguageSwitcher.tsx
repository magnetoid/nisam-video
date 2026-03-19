import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Globe } from "lucide-react";
import { buildPathForLanguage } from "@/lib/languageRouting";
import type { SupportedLanguageLite } from "@/types/languages";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const { data: languages = [] } = useQuery<SupportedLanguageLite[]>({
    queryKey: ["/api/languages"],
    staleTime: Infinity, // Ensure languages don't re-fetch unnecessarily
  });

  // Filter active languages
  const activeLanguages = languages.length > 0 ? languages.filter(l => l.isActive) : [
    { code: "en", name: "English", rootUri: "/en", isActive: true, isDefault: false },
    { code: "sr-Latn", name: "Srpski", rootUri: "/", isActive: true, isDefault: true }
  ];

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("language", lng);
    
    // Refresh page to apply language prefix routing correctly
    // Ideally we should use wouter history replacement but full reload ensures 
    // SEO paths are clean and backend state (SSR/hydration if any) matches.
    // For SPA, we can just navigate.
    
    const targetLang = activeLanguages.find(l => l.code === lng);
    if (!targetLang) return;

    const newPath = buildPathForLanguage(
      window.location.pathname,
      targetLang,
      activeLanguages,
    );
    window.location.href = newPath;
  };

  const currentLangCode = i18n.language;
  const currentLang = activeLanguages.find(l => l.code === currentLangCode);
  const getLanguageLabel = (lang: SupportedLanguageLite) => {
    const key = `languages.${lang.code}`;
    const translated = t(key, lang.name || lang.code);
    return translated || lang.name || lang.code;
  };

  const displayLabel = currentLang
    ? getLanguageLabel(currentLang)
    : t(`languages.${currentLangCode}`, currentLangCode);

  return (
    <div className="flex items-center gap-2" data-testid="language-switcher">
      <Globe className="w-4 h-4 text-muted-foreground" />
      <Select value={currentLangCode} onValueChange={changeLanguage}>
        <SelectTrigger className="w-[140px] h-8" data-testid="select-language">
           <span className="truncate">{displayLabel}</span>
        </SelectTrigger>
        <SelectContent>
          {activeLanguages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {getLanguageLabel(lang)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
