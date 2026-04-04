import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { useTranslation } from "react-i18next";

export default function TermsOfService() {
  const { t } = useTranslation();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Terms of Service - nisam.video",
    description: "Terms of service for nisam.video independent journalism platform.",
    url: "https://nisam.video/terms",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={t("terms.title", "Terms of Service")}
        description={t("terms.metaDescription", "Read the terms of service for nisam.video. Understand your rights and responsibilities when using our independent journalism platform.")}
        canonical="https://nisam.video/terms"
        structuredData={structuredData}
      />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 pt-24 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">{t("terms.title", "Terms of Service")}</h1>
        <div className="prose prose-invert max-w-none space-y-6 text-foreground/80">
          <p className="text-sm text-muted-foreground">{t("terms.lastUpdated", "Last updated: April 2026")}</p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.acceptanceTitle", "1. Acceptance of Terms")}</h2>
            <p>{t("terms.acceptanceText", "By accessing and using nisam.video (\"the Platform\"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service. These terms apply to all visitors, users, and others who access the Platform.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.serviceTitle", "2. Description of Service")}</h2>
            <p>{t("terms.serviceText1", "nisam.video is an independent journalism video aggregation platform. We collect, organize, and present publicly available video content from diverse media sources, independent journalists, and citizen reporters. Our mission is to support freedom of press and freedom of expression by making independent journalism accessible to everyone.")}</p>
            <p>{t("terms.serviceText2", "We do not host video content directly. All videos are embedded from their original platforms (YouTube, TikTok, and other sources). We use AI technology to categorize, tag, and organize content for easier discovery.")}</p>
            <p>{t("terms.serviceText3", "The Platform is accessible on all internet service providers in Serbia, including MTS (Mobilna Telefonija Srbije), SBB, and others. We are committed to ensuring equal access regardless of network provider.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.contentTitle", "3. Content & Copyright")}</h2>
            <p>{t("terms.contentText1", "All video content displayed on nisam.video is owned by its respective creators and original platforms. We aggregate and categorize publicly available content using AI technology. nisam.video does not claim ownership over any third-party content.")}</p>
            <p>{t("terms.contentText2", "If you are a content creator and wish to have your content removed from our platform, please contact us at dmca@nisam.video. We will process removal requests within 48 hours.")}</p>
            <p>{t("terms.contentText3", "The Platform's own content — including its design, logos, original text, and AI-generated categorizations — is the intellectual property of nisam.video and is protected under applicable copyright laws.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.freeExpressionTitle", "4. Freedom of Expression")}</h2>
            <p>{t("terms.freeExpressionText1", "nisam.video is built on the principle that freedom of press and freedom of expression are fundamental rights. We aggregate content from a wide range of independent sources to provide diverse perspectives.")}</p>
            <p>{t("terms.freeExpressionText2", "The views and opinions expressed in aggregated videos are those of the original content creators and do not necessarily reflect the views of nisam.video. We believe in presenting diverse viewpoints and allowing users to form their own opinions.")}</p>
            <p>{t("terms.freeExpressionText3", "We will not remove content based on political viewpoint or editorial position. Content will only be removed if it violates applicable laws or at the request of the original content creator.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.userConductTitle", "5. User Conduct")}</h2>
            <p>{t("terms.userConductIntro", "When using the Platform, you agree to:")}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t("terms.conductLawful", "Use the service only for lawful purposes and in accordance with these Terms")}</li>
              <li>{t("terms.conductNoAbuse", "Not attempt to abuse, overload, hack, or disrupt the service or its infrastructure")}</li>
              <li>{t("terms.conductNoScrape", "Not scrape, crawl, or collect data from our platform without prior written permission")}</li>
              <li>{t("terms.conductRespect", "Respect other users and content creators")}</li>
              <li>{t("terms.conductNoImpersonate", "Not impersonate any person or entity, or falsely state or misrepresent your affiliation")}</li>
              <li>{t("terms.conductNoMalware", "Not upload or transmit viruses, malware, or any harmful code")}</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.accountsTitle", "6. User Accounts")}</h2>
            <p>{t("terms.accountsText1", "You may create an account to access additional features such as liking videos and personalizing your experience. Registration is free and voluntary — you can browse all content without an account.")}</p>
            <p>{t("terms.accountsText2", "You are responsible for maintaining the security of your account and password. You must notify us immediately of any unauthorized access to your account.")}</p>
            <p>{t("terms.accountsText3", "We reserve the right to suspend or terminate accounts that violate these Terms of Service.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.suggestionsTitle", "7. Suggestions & Feedback")}</h2>
            <p>{t("terms.suggestionsText1", "We welcome and encourage user suggestions, feature requests, and feedback. Any suggestions you submit through our platform may be used by us to improve the service without any obligation to you.")}</p>
            <p>{t("terms.suggestionsText2", "By submitting a suggestion, you grant nisam.video a non-exclusive, perpetual, royalty-free license to use, implement, and share the idea as part of the Platform.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.disclaimerTitle", "8. Disclaimer of Warranties")}</h2>
            <p>{t("terms.disclaimerText1", "nisam.video is provided \"as is\" and \"as available\" without warranties of any kind, either express or implied. We do not guarantee the accuracy, completeness, timeliness, or availability of any content.")}</p>
            <p>{t("terms.disclaimerText2", "We are not responsible for the content of external videos, websites, or resources linked from our platform. We do not endorse, verify, or guarantee the accuracy of any third-party content.")}</p>
            <p>{t("terms.disclaimerText3", "We make no warranty that the service will be uninterrupted, secure, or error-free. Use of the service is at your own risk.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.liabilityTitle", "9. Limitation of Liability")}</h2>
            <p>{t("terms.liabilityText", "To the fullest extent permitted by law, nisam.video and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform. Our total liability for any claim arising from these Terms shall not exceed the amount you paid to us (if any) in the twelve months preceding the claim.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.changesTitle", "10. Changes to Terms")}</h2>
            <p>{t("terms.changesText", "We reserve the right to modify these Terms at any time. Significant changes will be announced on the Platform. Continued use of the service after changes constitutes acceptance of the updated Terms. We recommend reviewing these Terms periodically.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.governingLawTitle", "11. Governing Law")}</h2>
            <p>{t("terms.governingLawText", "These Terms shall be governed by and construed in accordance with the laws of the Republic of Serbia. Any disputes arising from these Terms or the use of the Platform shall be subject to the exclusive jurisdiction of the courts of the Republic of Serbia.")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">{t("terms.contactTitle", "12. Contact")}</h2>
            <p>{t("terms.contactText", "For questions about these Terms of Service, please contact us at legal@nisam.video. For content removal requests, contact dmca@nisam.video.")}</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
