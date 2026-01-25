import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Loader2 } from "lucide-react";
import type { SystemSettings } from "@shared/schema";

export default function About() {
  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/system/settings"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2
          className="w-8 h-8 animate-spin text-primary"
          data-testid="loading-about"
        />
      </div>
    );
  }

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

  const content = settings?.aboutPageContent || defaultContent;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      {/* Spacer for fixed header */}
      <div className="h-16" />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl flex-grow">
        <Card data-testid="card-about">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">O nama / About</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-invert max-w-none"
              data-testid="text-about-content"
              dangerouslySetInnerHTML={{
                __html: content
                  .split("\n")
                  .map((line: string) => {
                    if (line.startsWith("# ")) {
                      return `<h1 class="text-3xl font-bold mb-4 mt-6">${line.substring(2)}</h1>`;
                    } else if (line.startsWith("## ")) {
                      return `<h2 class="text-2xl font-bold mb-3 mt-5 text-primary">${line.substring(3)}</h2>`;
                    } else if (line.startsWith("### ")) {
                      return `<h3 class="text-xl font-semibold mb-2 mt-4">${line.substring(4)}</h3>`;
                    } else if (line.startsWith("- ")) {
                      return `<li class="ml-4 mb-1">${line.substring(2)}</li>`;
                    } else if (
                      line.trim().startsWith("**") &&
                      line.trim().endsWith("**")
                    ) {
                      return `<p class="font-bold mb-2">${line.trim().slice(2, -2)}</p>`;
                    } else if (line.includes("**")) {
                      return `<p class="mb-2">${line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</p>`;
                    } else if (line.startsWith("---")) {
                      return '<hr class="my-6 border-border" />';
                    } else if (line.trim() === "") {
                      return "<br />";
                    } else {
                      return `<p class="mb-2">${line}</p>`;
                    }
                  })
                  .join(""),
              }}
            />
          </CardContent>
        </Card>
      </div>
      
      <Footer />
    </div>
  );
}
