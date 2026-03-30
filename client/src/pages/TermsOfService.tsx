import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { useTranslation } from "react-i18next";

export default function TermsOfService() {
  const { t } = useTranslation();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Terms of Service",
    description: "Terms of service for nisam.video.",
    url: "https://nisam.video/terms",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={t("terms.title", "Terms of Service")}
        description={t("terms.metaDescription", "Read the terms of service for nisam.video. Understand your rights and responsibilities when using our platform.")}
        canonical="https://nisam.video/terms"
        structuredData={structuredData}
      />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 pt-24 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">{t("terms.title", "Terms of Service")}</h1>
        <div className="prose prose-invert max-w-none space-y-6 text-foreground/80">
          <p className="text-sm text-muted-foreground">{t("terms.lastUpdated", "Last updated: March 2026")}</p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.acceptanceTitle", "Acceptance of Terms")}</h2>
            <p>{t("terms.acceptanceText", "By accessing and using nisam.video, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.serviceTitle", "Description of Service")}</h2>
            <p>{t("terms.serviceText", "nisam.video is an AI-powered video aggregation platform that curates and organizes publicly available video content from YouTube and TikTok. We do not host video content directly — all videos are embedded from their original platforms.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.contentTitle", "Content & Copyright")}</h2>
            <p>{t("terms.contentText", "All video content displayed on nisam.video is owned by its respective creators and platforms. We aggregate and categorize publicly available content using AI. If you are a content creator and wish to have your content removed, please contact us at dmca@nisam.video.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.userConductTitle", "User Conduct")}</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("terms.conductLawful", "Use the service only for lawful purposes")}</li>
              <li>{t("terms.conductNoAbuse", "Do not attempt to abuse, overload, or disrupt the service")}</li>
              <li>{t("terms.conductNoScrape", "Do not scrape or collect data from our platform without permission")}</li>
              <li>{t("terms.conductRespect", "Respect other users and content creators")}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.disclaimerTitle", "Disclaimer")}</h2>
            <p>{t("terms.disclaimerText", "nisam.video is provided \"as is\" without warranties of any kind. We do not guarantee the accuracy, completeness, or availability of any content. We are not responsible for the content of external videos or websites linked from our platform.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.changesTitle", "Changes to Terms")}</h2>
            <p>{t("terms.changesText", "We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms. We will notify users of significant changes via the website.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.contactTitle", "Contact")}</h2>
            <p>{t("terms.contactText", "For questions about these Terms of Service, contact us at legal@nisam.video.")}</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
