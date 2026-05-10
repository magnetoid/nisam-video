import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Home, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { VideoGrid } from "@/components/VideoGrid";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import type { VideoWithLocalizedRelations } from "@shared/schema";
import { SEO } from "@/components/SEO";

export default function NotFound() {
  const { t } = useTranslation();

  // Fetch some random/popular videos to show as suggestions
  const { data: videos = [], isLoading } = useQuery<VideoWithLocalizedRelations[]>({
    queryKey: ["/api/videos", { limit: 12, sort: "random" }],
    queryFn: async () => {
      // Fetch random videos or popular ones as fallback
      const res = await fetch("/api/videos?limit=12&sort=random");
      if (!res.ok) throw new Error("Failed to fetch videos");
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={t("404.title", "Page Not Found")}
        description={t("404.description", "The page you are looking for does not exist.")}
        noindex
      />
      
      <Header />

      <main className="flex-grow container mx-auto px-4 py-12 flex flex-col items-center">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="flex justify-center mb-6">
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
            </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            {t("404.title", "Page Not Found")}
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8">
            {t("404.description", "Oops! The page you are looking for seems to have wandered off.")}
          </p>

          <Link href="/">
            <Button size="lg" className="gap-2">
              <Home className="h-5 w-5" />
              {t("404.backHome", "Go Back Home")}
            </Button>
          </Link>
        </div>

        {/* Suggested Videos */}
        <div className="w-full">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px bg-border flex-grow"></div>
            <h2 className="text-xl font-semibold text-muted-foreground whitespace-nowrap">
              {t("404.suggestions", "You might be interested in")}
            </h2>
            <div className="h-px bg-border flex-grow"></div>
          </div>

          <VideoGrid 
            videos={videos} 
            isLoading={isLoading} 
            skeletonCount={8}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
