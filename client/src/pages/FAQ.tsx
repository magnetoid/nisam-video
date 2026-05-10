import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SuggestFeatureDialog } from "@/components/SuggestFeatureDialog";
import { RecommendChannelDialog } from "@/components/RecommendChannelDialog";
import type { SeoSettings } from "@shared/schema";

interface FAQItem {
  question: string;
  answer: string;
}

function FAQAccordion({ question, answer }: FAQItem) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
        aria-expanded={open}
      >
        <span className="font-medium text-foreground">{question}</span>
        <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 text-foreground/80 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  const { t } = useTranslation();
  const { data: seoSettings } = useQuery<SeoSettings>({
    queryKey: ["/api/seo/settings"],
  });
  const siteName = seoSettings?.siteName || "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const faqs: FAQItem[] = [
    {
      question: t("faq.q1", "What is nisam.video?"),
      answer: t("faq.a1", "nisam.video is an independent journalism video platform that aggregates content from diverse media sources, independent journalists, and citizen reporters into one accessible place. We use AI technology to organize and categorize content, making it easy to find and follow independent reporting."),
    },
    {
      question: t("faq.q2", "Why does this platform exist?"),
      answer: t("faq.a2", "We believe that freedom of press and freedom of expression are fundamental rights. In an environment where media can be pressured or restricted, nisam.video provides a single platform where independent voices from various sources can be heard — accessible to everyone regardless of their network provider."),
    },
    {
      question: t("faq.q3", "Is nisam.video free to use?"),
      answer: t("faq.a3", "Yes, nisam.video is completely free. We believe access to independent journalism should be available to everyone. You can optionally support us through donations to help cover server and development costs."),
    },
    {
      question: t("faq.q4", "Do you host videos on your servers?"),
      answer: t("faq.a4", "No. All videos are embedded from their original platforms (YouTube, TikTok, and other sources). We only aggregate, organize, and categorize content — the videos always play from their original source. This means content creators retain full control over their content."),
    },
    {
      question: t("faq.q5", "Does it work on MTS and SBB?"),
      answer: t("faq.a5", "Yes. nisam.video is a web platform accessible on all internet service providers in Serbia, including MTS (Mobilna Telefonija Srbije), SBB, and any other provider. You can also install it as a PWA (Progressive Web App) on your phone for an app-like experience."),
    },
    {
      question: t("faq.q6", "How does the AI categorization work?"),
      answer: t("faq.a6", "Our AI system analyzes video titles, descriptions, and metadata to automatically assign relevant categories and tags. This helps organize thousands of videos into browsable topics — politics, economy, society, culture, and more — without manual intervention. The system updates automatically as new content is published."),
    },
    {
      question: t("faq.q7", "How often is new content added?"),
      answer: t("faq.a7", "Our system automatically checks all tracked channels every few hours for new videos. New content is categorized by AI and made available on the platform within minutes of being published on the original source."),
    },
    {
      question: t("faq.q8", "Can I suggest a channel or journalist to add?"),
      answer: t("faq.a8", "Absolutely! We encourage it. Use the 'Recommend Channel' option in the footer to suggest independent journalists, media outlets, or citizen reporters. Every recommendation is reviewed and quality channels are added to the platform."),
    },
    {
      question: t("faq.q9", "Can I suggest features or give feedback?"),
      answer: t("faq.a9", "Yes! We welcome all suggestions and feedback. Use the 'Suggest Feature' or 'Contact Us' options in the footer. We read every submission and work to implement the best ideas. This platform is built for the community, and your input directly shapes its development."),
    },
    {
      question: t("faq.q10", "What languages are supported?"),
      answer: t("faq.a10", "nisam.video currently supports English and Serbian (Latin script). The entire interface, categories, and tags are available in both languages. You can switch languages using the language selector in the footer."),
    },
    {
      question: t("faq.q11", "Do I need an account to use the platform?"),
      answer: t("faq.a11", "No. You can browse, search, and watch all content without creating an account. An optional free account lets you like videos and personalize your experience, but it's not required."),
    },
    {
      question: t("faq.q12", "I'm a content creator. How can I remove my content?"),
      answer: t("faq.a12", "If you are a content creator and wish to have your content removed from nisam.video, please contact us at dmca@nisam.video with your channel details. We process removal requests within 48 hours."),
    },
    {
      question: t("faq.q13", "How is this platform funded?"),
      answer: t("faq.a13", "nisam.video is funded through community donations and volunteer work. We do not run advertisements or sell user data. If you'd like to help keep the platform running, you can donate through our donation page."),
    },
    {
      question: t("faq.q14", "How can I support nisam.video?"),
      answer: t("faq.a14", "There are several ways to support us: donate on our donation page, recommend channels of independent journalists, suggest features to improve the platform, and share nisam.video with friends, family, and anyone who values independent journalism."),
    },
    {
      question: t("faq.q15", "Is my privacy protected?"),
      answer: t("faq.a15", "Yes. We collect minimal data, we do not sell or share personal information with third parties, and we do not use advertising trackers. Read our Privacy Policy for full details on how we handle your data."),
    },
  ];

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(faq => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={t("faq.title", "Frequently Asked Questions")}
        description={t("faq.metaDescription", siteName
          ? `Find answers to common questions about ${siteName}. Learn how it works, how to contribute, and more.`
          : "Find answers to common questions. Learn how it works, how to contribute, and more.")}
        canonical={`${origin}/faq`}
        structuredData={faqStructuredData}
      />
      <Header />
      <main id="main-content" className="flex-1 container mx-auto px-4 py-8 pt-24 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">{t("faq.title", "Frequently Asked Questions")}</h1>
        <p className="text-muted-foreground mb-8">
          {t("faq.subtitle", "Everything you need to know about nisam.video")}
        </p>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <FAQAccordion key={i} question={faq.question} answer={faq.answer} />
          ))}
        </div>

        <div className="mt-12 p-6 rounded-lg bg-muted/30 border border-border text-center space-y-4">
          <h2 className="text-lg font-semibold">{t("faq.stillHaveQuestions", "Still have questions?")}</h2>
          <p className="text-muted-foreground">
            {t("faq.contactUs", "Can't find what you're looking for? Get in touch with us — we're happy to help.")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <SuggestFeatureDialog>
              <span className="inline-flex items-center gap-2 text-primary hover:underline cursor-pointer font-medium">
                {t("faq.contactButton", "Contact Us")}
              </span>
            </SuggestFeatureDialog>
            <span className="hidden sm:block text-muted-foreground">|</span>
            <RecommendChannelDialog>
              <span className="inline-flex items-center gap-2 text-primary hover:underline cursor-pointer font-medium">
                {t("faq.recommendButton", "Recommend a Channel")}
              </span>
            </RecommendChannelDialog>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
