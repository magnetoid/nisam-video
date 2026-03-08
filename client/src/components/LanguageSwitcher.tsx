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
  rootUri: string | null;
  isActive: boolean;
  isDefault: boolean;
}

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [location, setLocation] = useLocation();

  const { data: languages = [] } = useQuery<SupportedLanguage[]>({
    queryKey: ["/api/languages"],
    staleTime: Infinity, // Ensure languages don't re-fetch unnecessarily
  });

  // Filter active languages
  const activeLanguages = languages.length > 0 ? languages.filter(l => l.isActive) : [
    { code: "en", name: "English", rootUri: "/en", isActive: true, isDefault: false },
    { code: "sr-Latn", name: "Srpski", rootUri: "/", isActive: true, isDefault: true }
  ];

  const getRootUri = (lang: SupportedLanguage) => {
    if (lang.rootUri) return lang.rootUri === '/' ? '' : lang.rootUri;
    return lang.isDefault ? '' : `/${lang.code}`;
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("language", lng);
    
    // Refresh page to apply language prefix routing correctly
    // Ideally we should use wouter history replacement but full reload ensures 
    // SEO paths are clean and backend state (SSR/hydration if any) matches.
    // For SPA, we can just navigate.
    
    const targetLang = activeLanguages.find(l => l.code === lng);
    if (!targetLang) return;

    const targetRootUri = getRootUri(targetLang);
    
    // Get current path without any language prefix
    let cleanPath = window.location.pathname;
    
    // Identify if current path has a language prefix from any active language
    // Sort by length desc to match longest prefixes first
    const sortedLangs = [...activeLanguages].sort((a, b) => {
      const uriA = getRootUri(a);
      const uriB = getRootUri(b);
      return uriB.length - uriA.length;
    });

    for (const l of sortedLangs) {
      const uri = getRootUri(l);
      if (!uri) continue; // Skip empty root uri (default usually)

      if (cleanPath.startsWith(`${uri}/`) || cleanPath === uri) {
        cleanPath = cleanPath.substring(uri.length) || "/";
        break;
      }
    }
    
    // Construct new path
    // If targetRootUri is empty, it means root path
    const newPath = targetRootUri 
      ? (cleanPath === "/" ? targetRootUri : `${targetRootUri}${cleanPath}`) 
      : cleanPath;
      
    window.location.href = newPath;
  };

  const currentLangCode = i18n.language;
  const currentLang = activeLanguages.find(l => l.code === currentLangCode);
  // Fallback for display label if language not yet loaded
  const displayLabel = currentLang ? currentLang.name : (currentLangCode === 'en' ? 'English' : 'Srpski');

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
              {lang.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
