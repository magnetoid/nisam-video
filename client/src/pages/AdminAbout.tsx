import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { queryClient } from "@/lib/queryClient";
import type { SystemSettings } from "@shared/schema";
import { Link } from "wouter";

export default function AdminAbout() {
  const { toast } = useToast();
  const [content, setContent] = useState("");

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/system/settings"],
    refetchOnMount: true,
  });

  const updateMutation = useMutation({
    mutationFn: async (newContent: string) => {
      const response = await fetch("/api/system/settings", {
        method: "PATCH",
        body: JSON.stringify({ aboutPageContent: newContent }),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Failed to update");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system/settings"] });
      toast({
        title: "Success",
        description: "About page content updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update about page content",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(content);
  };

  const defaultContent = `# O nama / About Us

## nisam.video - AI-Powered Video Hub

Dobrodošli na nisam.video, vašu novu platformu za otkrivanje i istraživanje video sadržaja! 

Welcome to nisam.video, your new platform for discovering and exploring video content!

### 🎯 Naša Misija / Our Mission

Naša misija je da vam omogućimo pristup kvalitetnom video sadržaju organizovanom pomoću veštačke inteligencije. Koristimo napredne AI algoritme za kategorizaciju i preporuku video sadržaja koji će vas sigurno zanimati.

Our mission is to provide you with access to quality video content organized using artificial intelligence. We use advanced AI algorithms to categorize and recommend video content that will surely interest you.

### ✨ Karakteristike / Features

- **AI Kategorizacija**: Automatska kategorizacija video sadržaja pomoću OpenAI GPT-5 tehnologije
- **Inteligentna Pretraga**: Napredne mogućnosti pretrage sa filterima po kategorijama i tagovima
- **Netflix-stil Interfejs**: Moderan i intuitivan dizajn inspirisan vodećim streaming platformama
- **SEO Optimizovano**: Svaki video ima svoju posvećenu stranicu optimizovanu za pretraživače
- **Višejezična Podrška**: Sadržaj dostupan na srpskom latiničnom i engleskom jeziku

- **AI Categorization**: Automatic video content categorization using OpenAI GPT-5 technology
- **Intelligent Search**: Advanced search capabilities with filters by categories and tags
- **Netflix-style Interface**: Modern and intuitive design inspired by leading streaming platforms
- **SEO Optimized**: Each video has its own dedicated page optimized for search engines
- **Multilingual Support**: Content available in Serbian Latin and English

### 📱 Progressive Web App

nisam.video je dostupna kao Progressive Web App (PWA), što znači da možete instalirati aplikaciju na vaš mobilni telefon ili desktop i koristiti je kao nativnu aplikaciju!

nisam.video is available as a Progressive Web App (PWA), which means you can install the app on your mobile phone or desktop and use it like a native application!

### 💡 Tehnologija / Technology

Naša platforma je izgrađena korišćenjem najsavremenijih tehnologija:
- React + TypeScript za frontend
- Express.js za backend
- PostgreSQL baza podataka
- OpenAI GPT-5 za AI kategorizaciju
- Tailwind CSS za styling

Our platform is built using cutting-edge technologies:
- React + TypeScript for frontend
- Express.js for backend
- PostgreSQL database
- OpenAI GPT-5 for AI categorization
- Tailwind CSS for styling

### 🤝 Podržite Nas / Support Us

Ako vam se sviđa nisam.video, razmislite o tome da nas podržite putem naše stranice za donacije. Vaša podrška nam pomaže da nastavimo da unapređujemo platformu i dodajemo nove funkcionalnosti!

If you like nisam.video, consider supporting us through our donations page. Your support helps us continue improving the platform and adding new features!

---

© ${new Date().getFullYear()} nisam.video - Sva prava zadržana / All rights reserved`;

  useEffect(() => {
    if (isLoading) return;
    if (content) return;

    if (settings?.aboutPageContent) {
      setContent(settings.aboutPageContent);
      return;
    }

    setContent(defaultContent);
  }, [content, defaultContent, isLoading, settings?.aboutPageContent]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Edit About Page</h1>
        <p className="text-muted-foreground">
          Customize the content displayed on the About page. Use markdown
          formatting.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              About Page Content
              <Link href="/about" target="_blank">
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-preview"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
              </Link>
            </CardTitle>
            <CardDescription>
              Edit the markdown content for the About page. Supports headings
              (#, ##, ###), bold (**text**), lists (- item), and more.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="font-mono text-sm"
              placeholder="Enter markdown content..."
              data-testid="textarea-about-content"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                data-testid="button-save-about"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Content
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Markdown Formatting Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>
                <code># Heading 1</code> - Large heading
              </p>
              <p>
                <code>## Heading 2</code> - Medium heading
              </p>
              <p>
                <code>### Heading 3</code> - Small heading
              </p>
              <p>
                <code>**Bold text**</code> - Bold formatting
              </p>
              <p>
                <code>- List item</code> - Bullet point
              </p>
              <p>
                <code>---</code> - Horizontal line
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
