import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type { SeoSettings } from "@shared/schema";

export default function PrivacyPolicy() {
  const { t } = useTranslation();

  const { data: seoSettings } = useQuery<SeoSettings>({
    queryKey: ["/api/seo/settings"],
  });
  const siteName = seoSettings?.siteName || "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const canonical = `${origin}/privacy`;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: siteName ? `${t("privacy.title", "Privacy Policy")} - ${siteName}` : t("privacy.title", "Privacy Policy"),
    description: t("privacy.metaDescription", siteName
      ? `Learn how ${siteName} collects, uses, and protects your personal information.`
      : "Learn how we collect, use, and protect your personal information."),
    url: canonical,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={t("privacy.title", "Privacy Policy")}
        description={t("privacy.metaDescription", siteName
          ? `Learn how ${siteName} collects, uses, and protects your personal information.`
          : "Learn how we collect, use, and protect your personal information.")}
        canonical={canonical}
        structuredData={structuredData}
      />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 pt-24 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">{t("privacy.title", "Privacy Policy")}</h1>
        <div className="prose prose-invert max-w-none space-y-6 text-foreground/80">
          <p className="text-sm text-muted-foreground">{t("privacy.lastUpdated", "Last updated: April 2026")}</p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("privacy.introTitle", "1. Introduction")}</h2>
            <p>{t("privacy.introText1", "nisam.video (\"we\", \"us\", or \"our\") operates the nisam.video website and platform. This Privacy Policy explains how we collect, use, store, and protect your personal data when you use our service.")}</p>
            <p>{t("privacy.introText2", "As a platform dedicated to independent journalism and freedom of press, we take your privacy seriously. We believe that access to independent media should not come at the cost of your personal data.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("privacy.dataCollectionTitle", "2. Data We Collect")}</h2>
            <p>{t("privacy.dataCollectionText", "We collect minimal data necessary to provide and improve our service:")}</p>

            <h3 className="text-lg font-medium text-foreground">{t("privacy.dataAutoTitle", "2.1 Automatically Collected Data")}</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("privacy.dataUsage", "Usage data: Pages visited, videos watched, and search queries (anonymized and aggregated)")}</li>
              <li>{t("privacy.dataDevice", "Device information: Browser type, operating system, screen resolution (for optimizing your experience)")}</li>
              <li>{t("privacy.dataIP", "IP address: Used for rate limiting, security, and approximate geographic location (not stored long-term)")}</li>
              <li>{t("privacy.dataPerformance", "Performance data: Page load times and errors (to improve service reliability)")}</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground">{t("privacy.dataCookiesTitle", "2.2 Cookies")}</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("privacy.dataCookieSession", "Session cookies: Required for authentication if you have an account")}</li>
              <li>{t("privacy.dataCookieLang", "Language preference cookie: Remembers your chosen language (English or Serbian)")}</li>
              <li>{t("privacy.dataCookieTheme", "Theme preference: Remembers your light/dark mode choice")}</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground">{t("privacy.dataAccountTitle", "2.3 Account Data")}</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("privacy.dataAccountInfo", "If you register: username, email (optional), and a securely hashed password")}</li>
              <li>{t("privacy.dataAccountActivity", "Account activity: Videos you have liked or interacted with")}</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground">{t("privacy.dataSuggestionsTitle", "2.4 Suggestions & Feedback")}</h3>
            <p>{t("privacy.dataSuggestionsText", "If you submit a suggestion, feature request, or contact message, we store the message content and your email (if provided) to respond and improve the platform.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("privacy.dataNotCollectedTitle", "3. Data We Do NOT Collect")}</h2>
            <p>{t("privacy.dataNotCollectedText", "We want to be transparent about what we don't do:")}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("privacy.noSell", "We do NOT sell, rent, or trade your personal data to third parties")}</li>
              <li>{t("privacy.noAdTracking", "We do NOT use advertising trackers or retargeting pixels")}</li>
              <li>{t("privacy.noProfile", "We do NOT build behavioral profiles for marketing purposes")}</li>
              <li>{t("privacy.noSocialTracking", "We do NOT track your activity across other websites")}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("privacy.howWeUseTitle", "4. How We Use Your Data")}</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("privacy.useProvide", "To provide, operate, and maintain the Platform")}</li>
              <li>{t("privacy.useImprove", "To improve user experience and content organization")}</li>
              <li>{t("privacy.useAnalytics", "To analyze aggregated usage patterns and optimize performance")}</li>
              <li>{t("privacy.useSecurity", "To protect against abuse, fraud, and security threats")}</li>
              <li>{t("privacy.useComm", "To respond to your inquiries, suggestions, and support requests")}</li>
              <li>{t("privacy.useLegal", "To comply with legal obligations when required by law")}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("privacy.thirdPartyTitle", "5. Third-Party Services")}</h2>
            <p>{t("privacy.thirdPartyIntro", "We use the following third-party services that may process some data:")}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("privacy.thirdYouTube", "YouTube (Google): Videos are embedded from YouTube. When you watch a video, YouTube may collect data according to Google's Privacy Policy.")}</li>
              <li>{t("privacy.thirdTikTok", "TikTok (ByteDance): TikTok videos are embedded from their platform. TikTok may collect data according to their Privacy Policy.")}</li>
              <li>{t("privacy.thirdCloudflare", "Cloudflare: We use Cloudflare for content delivery and security. Cloudflare may process your IP address and request headers.")}</li>
              <li>{t("privacy.thirdAnalytics", "Google Analytics (optional): If enabled, anonymized usage statistics are collected. You can opt out using browser extensions.")}</li>
            </ul>
            <p>{t("privacy.thirdPartyNote", "We recommend reviewing the privacy policies of these third-party services for complete details on their data practices.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("privacy.dataStorageTitle", "6. Data Storage & Security")}</h2>
            <p>{t("privacy.dataStorageText1", "Your data is stored in encrypted databases with SSL/TLS connections. We implement industry-standard security measures including password hashing, rate limiting, CSRF protection, and regular security audits.")}</p>
            <p>{t("privacy.dataStorageText2", "We retain personal data only as long as necessary to provide our services. Anonymized and aggregated analytics data may be retained indefinitely to improve the Platform.")}</p>
            <p>{t("privacy.dataStorageText3", "In the event of a data breach, we will notify affected users and relevant authorities within 72 hours as required by applicable data protection laws.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("privacy.rightsTitle", "7. Your Rights")}</h2>
            <p>{t("privacy.rightsIntro", "Under applicable data protection laws, you have the following rights:")}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("privacy.rightAccess", "Right of access: Request a copy of the personal data we hold about you")}</li>
              <li>{t("privacy.rightRectification", "Right to rectification: Request correction of inaccurate data")}</li>
              <li>{t("privacy.rightErasure", "Right to erasure: Request deletion of your personal data and account")}</li>
              <li>{t("privacy.rightRestriction", "Right to restriction: Request limitation of processing of your data")}</li>
              <li>{t("privacy.rightPortability", "Right to data portability: Request your data in a machine-readable format")}</li>
              <li>{t("privacy.rightObjection", "Right to object: Object to processing of your data for certain purposes")}</li>
            </ul>
            <p>{t("privacy.rightsExercise", "To exercise any of these rights, contact us at privacy@nisam.video. We will respond within 30 days.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("privacy.childrenTitle", "8. Children's Privacy")}</h2>
            <p>{t("privacy.childrenText", "Our Platform is not directed at children under the age of 13. We do not knowingly collect personal data from children under 13. If you believe we have inadvertently collected such data, please contact us and we will promptly delete it.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("privacy.changesTitle", "9. Changes to This Policy")}</h2>
            <p>{t("privacy.changesText", "We may update this Privacy Policy from time to time. Significant changes will be announced on the Platform. The \"Last updated\" date at the top of this page indicates when the policy was last revised. We recommend reviewing this policy periodically.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("privacy.contactTitle", "10. Contact")}</h2>
            <p>{t("privacy.contactText", "If you have questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us at privacy@nisam.video.")}</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
