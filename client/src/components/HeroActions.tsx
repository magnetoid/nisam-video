import { Play, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface HeroActionsProps {
  videoSlug?: string;
  videoId: string;
}

export function HeroActions({ videoSlug, videoId }: HeroActionsProps) {
  const [, setLocation] = useLocation();
  const targetPath = `/video/${videoSlug || videoId}`;

  return (
    <div className="flex items-center gap-3 pt-2">
      <Button
        size="lg"
        variant="secondary"
        onClick={() => setLocation(targetPath)}
        data-testid="button-play"
        className="gap-2 bg-foreground text-background hover:bg-foreground/90"
      >
        <Play className="h-5 w-5 fill-current" />
        Play
      </Button>

      <Button
        size="lg"
        variant="outline"
        onClick={() => setLocation(targetPath)}
        data-testid="button-info"
        className="gap-2 backdrop-blur-sm bg-background/30 border-foreground/30 hover:bg-background/50"
      >
        <Info className="h-5 w-5" />
        More Info
      </Button>
    </div>
  );
}