import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

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

  const faqs: FAQItem[] = [
    {
      question: t("faq.q1", "What is nisam.video?"),
      answer: t("faq.a1", "nisam.video is an AI-powered video aggregation platform. We discover, curate, and organize the best YouTube and TikTok content — automatically categorized, tagged, and sorted so you can find what you want to watch faster."),
    },
    {
      question: t("faq.q2", "Is nisam.video free to use?"),
      answer: t("faq.a2", "Yes, nisam.video is completely free. We don't charge for access to any content. You can optionally support us through donations to help cover server costs."),
    },
    {
      question: t("faq.q3", "Do you host videos?"),
      answer: t("faq.a3", "No. All videos are embedded from their original platforms (YouTube and TikTok). We only aggregate and organize content — the videos always play from their original source."),
    },
    {
      question: t("faq.q4", "How does the AI categorization work?"),
      answer: t("faq.a4", "Our AI analyzes video titles, descriptions, and metadata to automatically assign categories and tags. This helps organize content into browsable topics without manual intervention."),
    },
    {
      question: t("faq.q5", "Can I suggest a channel to add?"),
      answer: t("faq.a5", "Yes! Use the 'Recommend Channel' option in the footer to suggest YouTube or TikTok channels you'd like to see on our platform."),
    },
    {
      question: t("faq.q6", "How often is new content added?"),
      answer: t("faq.a6", "Our system automatically checks all tracked channels every 2 hours for new videos. New content is categorized and available within minutes of being published."),
    },
    {
      question: t("faq.q7", "What languages are supported?"),
      answer: t("faq.a7", "nisam.video currently supports English and Serbian (Latin script). Categories, tags, and the interface are available in both languages. You can switch languages using the language selector."),
    },
    {
      question: t("faq.q8", "I'm a content creator. How can I remove my content?"),
      answer: t("faq.a8", "If you want your content removed from nisam.video, please contact us at dmca@nisam.video with your channel details. We'll process removal requests promptly."),
    },
    {
      question: t("faq.q9", "Can I create an account?"),
      answer: t("faq.a9", "Yes. Creating an account lets you like videos and personalize your experience. Registration is free and requires only a username and password."),
    },
    {
      question: t("faq.q10", "How can I support nisam.video?"),
      answer: t("faq.a10", "You can support us by donating on our donation page, recommending channels, or simply sharing nisam.video with others who might enjoy it."),
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
        description={t("faq.metaDescription", "Find answers to common questions about nisam.video. Learn how our AI-powered video platform works, how to use it, and more.")}
        canonical="https://nisam.video/faq"
        structuredData={faqStructuredData}
      />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 pt-24 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">{t("faq.title", "Frequently Asked Questions")}</h1>
        <p className="text-muted-foreground mb-8">
          {t("faq.subtitle", "Everything you need to know about nisam.video")}
        </p>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <FAQAccordion key={i} question={faq.question} answer={faq.answer} />
          ))}
        </div>

        <div className="mt-12 p-6 rounded-lg bg-muted/30 border border-border text-center">
          <h2 className="text-lg font-semibold mb-2">{t("faq.stillHaveQuestions", "Still have questions?")}</h2>
          <p className="text-muted-foreground mb-4">
            {t("faq.contactUs", "Can't find what you're looking for? Get in touch.")}
          </p>
          <Link href="/about">
            <span className="text-primary hover:underline cursor-pointer">
              {t("faq.visitAbout", "Visit our About page")}
            </span>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
