import type { SupportedLanguage } from "@shared/schema";

export type SupportedLanguageLite = Pick<
  SupportedLanguage,
  "code" | "name" | "rootUri" | "isActive" | "isDefault"
>;

