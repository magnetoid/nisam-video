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
  isDefault: boolean;
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
    { code: "en", name: "English", isActive: true, isDefault: false },
    { code: "sr-Latn", name: "Srpski", isActive: true, isDefault: true }
  ];

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("language", lng);

    const currentPath = window.location.pathname;
    const targetLang = displayLanguages.find(l => l.code === lng);
    const isDefault = targetLang?.isDefault;

    // Remove any existing language prefix
    // Assuming prefix is always /code/ or /code at start
    // We need to know which codes are prefixes. 
    // Simplest is to check against all known secondary codes.
    
    let newPath = currentPath;
    
    // Check if path currently starts with any known secondary language code
    const secondaryLangs = displayLanguages.filter(l => !l.isDefault).map(l => l.code);
    for (const code of secondaryLangs) {
      if (newPath.startsWith(`/${code}/`)) {
        newPath = newPath.replace(`/${code}/`, "/");
        break;
      } else if (newPath === `/${code}`) {
        newPath = "/";
        break;
      }
    }

    // Now newPath is "clean" (root based)
    
    if (isDefault) {
      // Default language -> Root path
      window.location.href = newPath;
    } else {
      // Secondary language -> Prefix path
      // Ensure we don't double slash
      const prefix = `/${lng}`;
      const finalPath = newPath === "/" ? prefix : `${prefix}${newPath}`;
      window.location.href = finalPath;
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
