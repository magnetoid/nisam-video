import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";

function humanizeMissingKey(key: string): string {
  const last = key.split(".").filter(Boolean).pop() || key;
  const spaced = last
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    backend: {
      loadPath: "/api/locales/{{lng}}/{{ns}}",
    },
    lng: localStorage.getItem("language") || "sr-Latn",
    fallbackLng: "en",
    returnNull: false,
    returnEmptyString: false,
    parseMissingKeyHandler: (key) => humanizeMissingKey(String(key)),
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: true, // Enable suspense for loading
    },
  });

export default i18n;
