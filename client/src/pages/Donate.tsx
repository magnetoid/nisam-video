import { useTranslation } from "react-i18next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Heart, CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "dbox-widget": any;
    }
  }
}

export default function Donate() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;

  const hreflangLinks = [
    { lang: "sr-Latn", url: "https://nisam.video/donate" },
    { lang: "en", url: "https://nisam.video/donate" },
    { lang: "x-default", url: "https://nisam.video/donate" },
  ];

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://donorbox.org/widgets.js";
    script.type = "module";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={t("donate.title")}
        description={t("donate.description")}
        path="/donate"
        canonical="https://nisam.video/donate"
        hreflang={hreflangLinks}
      />
      <Header />

      {/* Spacer for fixed header */}
      <div className="h-16" />

      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-primary/20 via-background to-background py-16 md:py-24">
        <div className="px-8 md:px-16 max-w-5xl mx-auto">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
              <Heart className="w-8 h-8 text-primary" />
            </div>

            <h1
              className="text-4xl md:text-6xl font-bold"
              data-testid="text-donate-title"
            >
              {t("donate.title")}
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              {t("donate.hero")}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-8 md:px-16 py-12 max-w-6xl mx-auto w-full">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Left Column - Info */}
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-lg text-foreground/90">
                {t("donate.description")}
              </p>

              <ul className="space-y-3">
                {[1, 2, 3, 4, 5].map((num) => (
                  <li key={num} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-foreground/90">
                      {t(`donate.benefit${num}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-3">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                {t("donate.impact")}
              </h3>
              <p className="text-muted-foreground">{t("donate.impactText")}</p>
            </div>

            <div className="text-center p-8 bg-gradient-to-br from-primary/10 to-transparent rounded-lg border border-primary/20">
              <p className="text-2xl font-bold text-primary mb-2">
                {t("donate.thankYou")}
              </p>
              <p className="text-foreground/80">{t("donate.community")}</p>
            </div>
          </div>

          {/* Right Column - Donation Form */}
          <div className="md:sticky md:top-24">
            <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
              <h2
                className="text-2xl font-bold mb-6 text-center"
                data-testid="text-donation-form"
              >
                {currentLang === "sr-Latn"
                  ? "Izaberite iznos"
                  : "Choose Amount"}
              </h2>

              {/* Donorbox Widget */}
              <div className="min-h-[500px]">
                <dbox-widget
                  campaign="support-nisam-video"
                  type="donation_form"
                  enable-auto-scroll="true"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
