import { describe, it, expect } from "vitest";
import {
  buildPathForLanguage,
  stripLanguagePrefix,
  getLanguageRootUri,
} from "../client/src/lib/languageRouting";

describe("languageRouting", () => {
  const langs = [
    { code: "sr-Latn", rootUri: "/", isDefault: true },
    { code: "en", rootUri: "/en", isDefault: false },
    { code: "fr", rootUri: "/fr", isDefault: false },
  ];

  it("computes root URIs consistently", () => {
    expect(getLanguageRootUri(langs[0])).toBe("");
    expect(getLanguageRootUri(langs[1])).toBe("/en");
  });

  it("strips language prefix when present", () => {
    expect(stripLanguagePrefix("/en/categories", langs)).toEqual({
      cleanPath: "/categories",
      base: "/en",
      matched: langs[1],
    });
    expect(stripLanguagePrefix("/fr", langs)).toEqual({
      cleanPath: "/",
      base: "/fr",
      matched: langs[2],
    });
  });

  it("leaves path unchanged when no prefix matches", () => {
    expect(stripLanguagePrefix("/categories", langs)).toEqual({
      cleanPath: "/categories",
      base: "",
    });
  });

  it("builds new path for target language", () => {
    expect(buildPathForLanguage("/en/categories", langs[0], langs)).toBe(
      "/categories",
    );
    expect(buildPathForLanguage("/categories", langs[1], langs)).toBe(
      "/en/categories",
    );
    expect(buildPathForLanguage("/", langs[1], langs)).toBe("/en");
  });
});

