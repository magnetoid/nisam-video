import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { useTranslation } from "react-i18next";

export default function PrivacyPolicy() {
  const { t } = useTranslation();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Privacy Policy",
    description: "Privacy policy for nisam.video - how we handle your data.",
    url: "https://nisam.video/privacy",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={t("privacy.title", "Privacy Policy")}
        description={t("privacy.metaDescription", "Learn how nisam.video collects, uses, and protects your personal information. Read our full privacy policy.")}
        canonical="https://nisam.video/privacy"
        structuredData={structuredData}
      />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 pt-24 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">{t("privacy.title", "Privacy Policy")}</h1>
        <div className="prose prose-invert max-w-none space-y-6 text-foreground/80">
          <p className="text-sm text-muted-foreground">{t("privacy.lastUpdated", "Last updated: March 2026")}</p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("privacy.introTitle", "Introduction")}</h2>
            <p>{t("privacy.introText", "nisam.video (\"we\", \"us\", or \"our\") operates the nisam.video website. This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our service.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("privacy.dataCollectionTitle", "Data We Collect")}</h2>
            <p>{t("privacy.dataCollectionText", "We collect minimal data to provide and improve our service:")}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("privacy.dataUsage", "Usage data: Pages visited, videos watched, search queries (anonymized)")}</li>
              <li>{t("privacy.dataCookies", "Cookies: Session cookies for authentication, language preference cookies")}</li>
              <li>{t("privacy.dataAccount", "Account data: If you register, we store your username and email")}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("privacy.howWeUseTitle", "How We Use Your Data")}</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("privacy.useProvide", "To provide and maintain our service")}</li>
              <li>{t("privacy.useImprove", "To improve user experience and content recommendations")}</li>
              <li>{t("privacy.useAnalytics", "To analyze usage patterns and optimize performance")}</li>
              <li>{t("privacy.useComm", "To communicate service updates (if you opt in)")}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("privacy.thirdPartyTitle", "Third-Party Services")}</h2>
            <p>{t("privacy.thirdPartyText", "We embed content from YouTube and TikTok. When you watch a video, those platforms may collect data according to their own privacy policies. We also use Cloudflare for content delivery and security.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("privacy.cookiesTitle", "Cookies")}</h2>
            <p>{t("privacy.cookiesText", "We use essential cookies for authentication and preferences. We do not use third-party advertising cookies. You can disable cookies in your browser settings, but some features may not work properly.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("privacy.rightsTitle", "Your Rights")}</h2>
            <p>{t("privacy.rightsText", "You have the right to access, correct, or delete your personal data. You can delete your account at any time from your settings page. For any privacy-related requests, contact us at privacy@nisam.video.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("privacy.contactTitle", "Contact")}</h2>
            <p>{t("privacy.contactText", "If you have questions about this Privacy Policy, please contact us at privacy@nisam.video.")}</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
