import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Search, 
  Cpu, 
  Globe, 
  Smartphone, 
  Zap,
  Github,
  Twitter,
  Heart
} from "lucide-react";
import { Link } from "wouter";
import type { SystemSettings } from "@shared/schema";

export default function About() {
  const { data: settings } = useQuery<SystemSettings>({
    queryKey: ["/api/system/settings"],
  });

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <Header />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-background" />
        
        <div className="container relative mx-auto px-4 text-center z-10">
          <Badge variant="outline" className="mb-6 py-1 px-4 text-primary border-primary/30 bg-primary/10 backdrop-blur-sm">
            Discover • Watch • Enjoy
          </Badge>
          <h1 className="text-4xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/50">
            nisam.video
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Your intelligent hub for curated video content. 
            Powered by AI to bring you the best of the web, organized and personalized.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <Button size="lg" className="h-12 px-8 text-lg gap-2">
                <Play className="fill-current w-4 h-4" /> Start Watching
              </Button>
            </Link>
            <Link href="/categories">
              <Button size="lg" variant="outline" className="h-12 px-8 text-lg">
                Explore Categories
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Cpu className="w-10 h-10 text-primary" />}
              title="AI-Powered Curation"
              description="Our advanced algorithms analyze and categorize content automatically, ensuring you find exactly what you're looking for without the noise."
            />
            <FeatureCard 
              icon={<Search className="w-10 h-10 text-blue-500" />}
              title="Smart Discovery"
              description="Intelligent search and recommendation engines help you uncover hidden gems and trending videos tailored to your interests."
            />
            <FeatureCard 
              icon={<Smartphone className="w-10 h-10 text-green-500" />}
              title="Mobile First"
              description="Experience seamless viewing on any device. Install as a PWA for a native app-like experience on your phone or tablet."
            />
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1 space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">Our Mission</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                We believe that finding great content shouldn't be a chore. In an ocean of infinite uploads, 
                <span className="text-primary font-semibold"> nisam.video</span> acts as your lighthouse, 
                guiding you to quality videos that matter.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                By leveraging cutting-edge Artificial Intelligence (GPT-5) and modern web technologies, 
                we're building the future of video aggregation—privacy-focused, ad-free, and community-driven.
              </p>
              
              <div className="pt-4 flex gap-4">
                 <div className="flex flex-col gap-1">
                    <span className="text-3xl font-bold">10k+</span>
                    <span className="text-sm text-muted-foreground">Curated Videos</span>
                 </div>
                 <div className="w-px bg-border h-12" />
                 <div className="flex flex-col gap-1">
                    <span className="text-3xl font-bold">50+</span>
                    <span className="text-sm text-muted-foreground">Smart Categories</span>
                 </div>
                 <div className="w-px bg-border h-12" />
                 <div className="flex flex-col gap-1">
                    <span className="text-3xl font-bold">24/7</span>
                    <span className="text-sm text-muted-foreground">Auto-Updates</span>
                 </div>
              </div>
            </div>
            
            <div className="flex-1 w-full relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-3xl blur-3xl opacity-50" />
                <div className="relative bg-card border border-border/50 rounded-2xl p-8 shadow-2xl">
                    <div className="grid grid-cols-2 gap-4">
                        <TechItem icon={<Zap />} label="Fast" />
                        <TechItem icon={<Globe />} label="Global" />
                        <TechItem icon={<Heart />} label="Curated" />
                        <TechItem icon={<Cpu />} label="AI" />
                    </div>
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack / Footer Note */}
      <section className="py-20 border-t border-border/50">
        <div className="container mx-auto px-4 text-center">
            <h3 className="text-2xl font-semibold mb-8">Built with Modern Tech</h3>
            <div className="flex flex-wrap justify-center gap-4 md:gap-8 opacity-70">
                <span className="px-4 py-2 bg-muted rounded-full text-sm font-medium">React 18</span>
                <span className="px-4 py-2 bg-muted rounded-full text-sm font-medium">TypeScript</span>
                <span className="px-4 py-2 bg-muted rounded-full text-sm font-medium">Tailwind CSS</span>
                <span className="px-4 py-2 bg-muted rounded-full text-sm font-medium">PostgreSQL</span>
                <span className="px-4 py-2 bg-muted rounded-full text-sm font-medium">OpenAI</span>
                <span className="px-4 py-2 bg-muted rounded-full text-sm font-medium">Drizzle ORM</span>
            </div>

            <div className="mt-16 flex justify-center gap-6">
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10 hover:text-primary">
                    <Twitter className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10 hover:text-primary">
                    <Github className="w-5 h-5" />
                </Button>
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

function TechItem({ icon, label }: { icon: React.ReactNode, label: string }) {
    return (
        <div className="flex flex-col items-center justify-center p-6 bg-background rounded-xl border border-border/50">
            <div className="mb-3 text-primary">{icon}</div>
            <span className="font-medium">{label}</span>
        </div>
    )
}
