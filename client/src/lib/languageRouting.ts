export type LanguageRoutingConfig = {
  code: string;
  rootUri: string | null;
  isDefault: boolean;
};

export function getLanguageRootUri(lang: LanguageRoutingConfig): string {
  if (lang.rootUri) return lang.rootUri === "/" ? "" : lang.rootUri;
  return lang.isDefault ? "" : `/${lang.code}`;
}

export function stripLanguagePrefix(
  pathname: string,
  languages: LanguageRoutingConfig[],
): { cleanPath: string; base: string; matched?: LanguageRoutingConfig } {
  const sorted = [...languages]
    .map((l) => ({ l, uri: getLanguageRootUri(l) }))
    .filter((x) => x.uri)
    .sort((a, b) => b.uri.length - a.uri.length);

  for (const { l, uri } of sorted) {
    if (pathname === uri || pathname.startsWith(`${uri}/`)) {
      return {
        cleanPath: pathname.substring(uri.length) || "/",
        base: uri,
        matched: l,
      };
    }
  }

  return { cleanPath: pathname || "/", base: "" };
}

export function buildPathForLanguage(
  pathname: string,
  targetLanguage: LanguageRoutingConfig,
  languages: LanguageRoutingConfig[],
): string {
  const { cleanPath } = stripLanguagePrefix(pathname, languages);
  const targetRoot = getLanguageRootUri(targetLanguage);
  if (!targetRoot) return cleanPath;
  return cleanPath === "/" ? targetRoot : `${targetRoot}${cleanPath}`;
}

