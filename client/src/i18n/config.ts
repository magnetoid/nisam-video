import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";

i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    backend: {
      loadPath: "/api/locales/{{lng}}/{{ns}}",
    },
    lng: localStorage.getItem("language") || "sr-Latn",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: true, // Enable suspense for loading
    },
  });

export default i18n;
