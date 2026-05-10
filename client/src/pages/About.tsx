import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Shield,
  Newspaper,
  Users,
  Globe,
  Smartphone,
  Heart,
  MessageSquare,
  Megaphone,
  Scale,
  Eye,
  Radio,
} from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { SuggestFeatureDialog } from "@/components/SuggestFeatureDialog";
import type { SystemSettings, SeoSettings } from "@shared/schema";

export default function About() {
  const { t } = useTranslation();
  const { data: settings } = useQuery<SystemSettings>({
    queryKey: ["/api/system/settings"],
  });
  const { data: seoSettings } = useQuery<SeoSettings>({
    queryKey: ["/api/seo/settings"],
  });

  const siteName = seoSettings?.siteName || "";
  const siteDescription = seoSettings?.siteDescription || "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const logoUrl = settings?.pwaIcon512 ? `${origin}${settings.pwaIcon512}` : `${origin}/icon-512.png`;

  const aboutStructuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: siteName,
        url: origin,
        logo: {
          "@type": "ImageObject",
          url: logoUrl,
          width: 512,
          height: 512,
        },
        description: siteDescription,
        sameAs: [],
      },
      {
        "@type": "WebPage",
        "@id": `${origin}/about`,
        url: `${origin}/about`,
        name: siteName ? `${t("about.title", "About")} ${siteName}` : t("about.title", "About"),
        isPartOf: { "@id": `${origin}/#website` },
        about: { "@id": `${origin}/#organization` },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: t("about.faq.what.q", siteName ? `What is ${siteName}?` : "What is this platform?"),
            acceptedAnswer: {
              "@type": "Answer",
              text: t("about.faq.what.a", siteDescription || ""),
            },
          },
          {
            "@type": "Question",
            name: t("about.faq.free.q", siteName ? `Is ${siteName} free to use?` : "Is it free to use?"),
            acceptedAnswer: {
              "@type": "Answer",
              text: t("about.faq.free.a", siteName
                ? `Yes, ${siteName} is completely free.`
                : "Yes, it is completely free."),
            },
          },
          {
            "@type": "Question",
            name: t("about.faq.support.q", "How can I support this platform?"),
            acceptedAnswer: {
              "@type": "Answer",
              text: t("about.faq.support.a", "You can support us by donating, recommending channels, suggesting features, or sharing the platform with others."),
            },
          },
          {
            "@type": "Question",
            name: t("about.faq.suggest.q", "Can I suggest a channel or feature?"),
            acceptedAnswer: {
              "@type": "Answer",
              text: t("about.faq.suggest.a", "Yes — use the 'Suggest Feature' or 'Recommend Channel' options to share your ideas. Every suggestion is reviewed."),
            },
          },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <SEO
        title={t("about.title", "About")}
        description={siteDescription}
        canonical={`${origin}/about`}
        structuredData={aboutStructuredData}
      />
      <Header />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-background" />

        <div className="container relative mx-auto px-4 text-center z-10">
          <Badge variant="outline" className="mb-6 py-1 px-4 text-primary border-primary/30 bg-primary/10 backdrop-blur-sm">
            {t("about.tagline", "Independent Journalism • Free Press • One Platform")}
          </Badge>
          <h1 className="text-4xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/50">
            nisam.video
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed">
            {t("about.heroDescription", "One platform for independent journalism. We aggregate diverse video sources so you can access free, uncensored reporting — on any network, any device.")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <Button size="lg" className="h-12 px-8 text-lg gap-2">
                <Play className="fill-current w-4 h-4" /> {t("about.startWatching", "Start Watching")}
              </Button>
            </Link>
            <Link href="/donate">
              <Button size="lg" variant="outline" className="h-12 px-8 text-lg gap-2 border-primary/50 text-primary hover:bg-primary/10">
                <Heart className="w-4 h-4" /> {t("about.supportUs", "Support Us")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Why We Exist */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("about.whyTitle", "Why This Platform Exists")}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("about.whyDescription", "In a media landscape where information can be filtered, blocked, or controlled, we believe every citizen deserves access to diverse, independent voices.")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Shield className="w-10 h-10 text-primary" />}
              title={t("about.features.pressFreedom.title", "Freedom of Press")}
              description={t("about.features.pressFreedom.description", "We stand for the fundamental right to free press. Our platform ensures independent journalism remains accessible to everyone, without censorship or interference.")}
            />
            <FeatureCard
              icon={<Newspaper className="w-10 h-10 text-blue-500" />}
              title={t("about.features.civilJournalism.title", "Civil Journalism")}
              description={t("about.features.civilJournalism.description", "Citizen reporters, independent outlets, and grassroots media — all aggregated into one platform. Every voice matters when it comes to truth and transparency.")}
            />
            <FeatureCard
              icon={<Globe className="w-10 h-10 text-green-500" />}
              title={t("about.features.universalAccess.title", "Universal Access")}
              description={t("about.features.universalAccess.description", "Available on both MTS and SBB networks, on any device. No matter your provider, you have equal access to independent media and free expression.")}
            />
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1 space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">{t("about.mission.title", "Our Mission")}</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("about.mission.p1", "We believe that access to independent journalism is a fundamental right, not a privilege. In an environment where media can be pressured, restricted, or silenced, nisam.video serves as a digital safeguard — aggregating independent sources into one platform that anyone can access.")}
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("about.mission.p2", "Freedom of press and freedom of expression must be preserved. We pull sources from independent journalists, civil reporters, and diverse media outlets — so you always have access to the full picture, not just one narrative.")}
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {t("about.mission.p3", "Whether you use MTS (Mobilna Telefonija Srbije), SBB, or any other provider — this platform works for you. Because independent information should never depend on which network you subscribe to.")}
              </p>

              <div className="pt-4 flex gap-4">
                 <div className="flex flex-col gap-1">
                    <span className="text-3xl font-bold">10k+</span>
                    <span className="text-sm text-muted-foreground">{t("about.stats.curatedVideos", "Curated Videos")}</span>
                 </div>
                 <div className="w-px bg-border h-12" />
                 <div className="flex flex-col gap-1">
                    <span className="text-3xl font-bold">50+</span>
                    <span className="text-sm text-muted-foreground">{t("about.stats.independentSources", "Independent Sources")}</span>
                 </div>
                 <div className="w-px bg-border h-12" />
                 <div className="flex flex-col gap-1">
                    <span className="text-3xl font-bold">24/7</span>
                    <span className="text-sm text-muted-foreground">{t("about.stats.autoUpdates", "Auto-Updates")}</span>
                 </div>
              </div>
            </div>

            <div className="flex-1 w-full relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-3xl blur-3xl opacity-50" />
                <div className="relative bg-card border border-border/50 rounded-2xl p-8 shadow-2xl">
                    <div className="grid grid-cols-2 gap-4">
                        <PrincipleItem icon={<Scale />} label={t("about.principles.truth", "Truth")} />
                        <PrincipleItem icon={<Eye />} label={t("about.principles.transparency", "Transparency")} />
                        <PrincipleItem icon={<Megaphone />} label={t("about.principles.freeExpression", "Free Expression")} />
                        <PrincipleItem icon={<Radio />} label={t("about.principles.independence", "Independence")} />
                    </div>
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* Support Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Heart className="w-12 h-12 text-primary mx-auto" />
            <h2 className="text-3xl md:text-4xl font-bold">{t("about.support.title", "We Need Your Support")}</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t("about.support.p1", "This platform is built by people who believe in free press and independent journalism. But to keep it running, growing, and improving — we need your help.")}
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t("about.support.p2", "Every donation, every shared link, every recommended channel helps us expand our reach and bring more independent voices to light. Together, we can make sure that free journalism stays free.")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/donate">
                <Button size="lg" className="h-12 px-8 text-lg gap-2">
                  <Heart className="w-4 h-4" /> {t("about.support.donate", "Donate Now")}
                </Button>
              </Link>
              <SuggestFeatureDialog>
                <Button size="lg" variant="outline" className="h-12 px-8 text-lg gap-2">
                  <MessageSquare className="w-4 h-4" /> {t("about.support.suggestFeature", "Suggest a Feature")}
                </Button>
              </SuggestFeatureDialog>
            </div>
          </div>
        </div>
      </section>

      {/* Community / Suggestions Section */}
      <section className="py-20 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Users className="w-12 h-12 text-blue-500 mx-auto" />
            <h2 className="text-3xl md:text-4xl font-bold">{t("about.community.title", "Your Voice Matters")}</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t("about.community.description", "This is a community-driven platform. Any recommendation or suggestion you have is free to provide — and we will implement it. Whether it's a new feature, a channel to add, or an improvement idea, we want to hear from you.")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 text-left">
              <div className="bg-card border border-border/50 rounded-xl p-6 space-y-3">
                <Newspaper className="w-8 h-8 text-primary" />
                <h3 className="font-semibold">{t("about.community.recommendChannel", "Recommend a Channel")}</h3>
                <p className="text-sm text-muted-foreground">{t("about.community.recommendChannelDesc", "Know an independent journalist or outlet? Suggest their channel and help us broaden our coverage.")}</p>
              </div>
              <div className="bg-card border border-border/50 rounded-xl p-6 space-y-3">
                <MessageSquare className="w-8 h-8 text-blue-500" />
                <h3 className="font-semibold">{t("about.community.suggestFeature", "Suggest a Feature")}</h3>
                <p className="text-sm text-muted-foreground">{t("about.community.suggestFeatureDesc", "Have an idea to make the platform better? We read every suggestion and work to implement the best ones.")}</p>
              </div>
              <div className="bg-card border border-border/50 rounded-xl p-6 space-y-3">
                <Megaphone className="w-8 h-8 text-green-500" />
                <h3 className="font-semibold">{t("about.community.spreadTheWord", "Spread the Word")}</h3>
                <p className="text-sm text-muted-foreground">{t("about.community.spreadTheWordDesc", "Share nisam.video with friends and family. The more people know about us, the stronger independent journalism becomes.")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Access */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-2xl font-semibold mb-4">{t("about.access.title", "Available on All Networks")}</h3>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">{t("about.access.description", "Accessible on MTS, SBB, and all other providers. Install as an app on your phone or simply open it in your browser.")}</p>
          <div className="flex flex-wrap justify-center gap-4 md:gap-8">
            <span className="px-5 py-2.5 bg-card border border-border/50 rounded-full text-sm font-medium">MTS (Mobilna Telefonija Srbije)</span>
            <span className="px-5 py-2.5 bg-card border border-border/50 rounded-full text-sm font-medium">SBB</span>
            <span className="px-5 py-2.5 bg-card border border-border/50 rounded-full text-sm font-medium"><Smartphone className="w-4 h-4 inline mr-1" />{t("about.access.pwa", "PWA App")}</span>
            <span className="px-5 py-2.5 bg-card border border-border/50 rounded-full text-sm font-medium"><Globe className="w-4 h-4 inline mr-1" />{t("about.access.web", "Web Browser")}</span>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-card hover:bg-card/80 transition-colors p-8 rounded-2xl border border-border/50 shadow-sm">
      <div className="mb-6 p-3 bg-background rounded-xl inline-block shadow-sm">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function PrincipleItem({ icon, label }: { icon: React.ReactNode, label: string }) {
    return (
        <div className="flex flex-col items-center justify-center p-6 bg-background rounded-xl border border-border/50">
            <div className="mb-3 text-primary">{icon}</div>
            <span className="font-medium">{label}</span>
        </div>
    )
}
