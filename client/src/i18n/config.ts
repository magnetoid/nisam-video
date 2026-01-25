import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import srLatn from "./locales/sr-Latn.json";
import en from "./locales/en.json";

i18n.use(initReactI18next).init({
  resources: {
    "sr-Latn": { translation: srLatn },
    en: { translation: en },
  },
  lng: localStorage.getItem("language") || "sr-Latn",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
