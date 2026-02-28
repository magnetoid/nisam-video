import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Eye, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clampIndex } from '@/utils/heroSlider';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

type HeroSlideItem = {
  id: string;
  title: string;
  imageUrl: string | null | undefined;
  slug?: string;
  buttonLink?: string;
  primaryCategory?: string;
  secondaryCategories?: string[];
  viewCount?: string | null;
  publishDate?: string | null;
  description?: string | null;
};

const FALLBACK_SLIDES: Array<{ id: string; title: string; imageUrl: string }> = [
  {
    id: 'fallback-1',
    title: '',
    imageUrl:
      'https://coreva-normal.trae.ai/api/ide/v1/text_to_image?prompt=cinematic%20dark%20abstract%20background%2C%20netflix%20style%20red%20and%20black%20gradient%2C%20subtle%20film%20grain%2C%20vignette%2C%20high%20quality%204k%2C%20no%20text%2C%20minimalist&image_size=landscape_16_9',
  }
];

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

type Props = {
  items?: HeroSlideItem[];
  ariaLabel?: string;
};

const HeroImageSlider: React.FC<Props> = ({ items, ariaLabel = 'Featured titles' }) => {
  const reducedMotion = prefersReducedMotion();
  const textShadowStyle = useMemo(() => ({ textShadow: '1px 1px 2px rgba(0, 0, 0, 0.35)' }), []);

  const slides = useMemo(() => {
    const primary = (items || [])
      .filter((it) => typeof it?.title === 'string' && it.title.trim().length > 0)
      .map((it, idx) => ({
        id: it.id || `primary-${idx}`,
        title: it.title,
        imageUrl: it.imageUrl || null,
        slug: it.slug,
        buttonLink: it.buttonLink
      }));

    if (primary.length === 0) {
       // Only show fallback if absolutely no content
       const fb = FALLBACK_SLIDES[0];
       return [{ id: fb.id, title: fb.title, imageUrl: fb.imageUrl, slug: '', buttonLink: '' }];
    }
    
    return primary;
  }, [items]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [primaryFailed, setPrimaryFailed] = useState<Record<number, boolean>>({});
  const interactionRef = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);

  const activeIndex = clampIndex(currentIndex, slides.length);
  const activeSlide = slides[activeIndex];

  const resolveImageUrl = (index: number): string => {
    const slide = slides[index];
    const shouldUseFallback = primaryFailed[index] || !slide?.imageUrl;
    if (!shouldUseFallback && slide.imageUrl) return slide.imageUrl;

    const fbIdx = 0; // Always use the first fallback
    return FALLBACK_SLIDES[fbIdx].imageUrl;
  };

  const scheduleAutoplay = useCallback(() => {
    if (interactionRef.current) window.clearInterval(interactionRef.current);
    if (reducedMotion) return;
    if (isPaused) return;
    interactionRef.current = window.setInterval(() => {
      setCurrentIndex((prev) => clampIndex(prev + 1, slides.length));
    }, 5000);
  }, [isPaused, reducedMotion, slides.length]);

  useEffect(() => {
    scheduleAutoplay();
    return () => {
      if (interactionRef.current) window.clearInterval(interactionRef.current);
    };
  }, [scheduleAutoplay]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const nextIndex = clampIndex(activeIndex + 1, slides.length);
    const img = new Image();
    img.src = resolveImageUrl(nextIndex);
  }, [activeIndex, slides.length]);

  useEffect(() => {
    if (activeIndex >= slides.length) setCurrentIndex(0);
  }, [activeIndex, slides.length]);

  const goTo = (idx: number) => {
    setCurrentIndex(clampIndex(idx, slides.length));
    scheduleAutoplay();
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLElement> = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(activeIndex - 1);
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(activeIndex + 1);
    }
  };

  return (
    <section
      ref={(el) => {
        sectionRef.current = el;
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (!next || !sectionRef.current?.contains(next)) setIsPaused(false);
      }}
      className="relative w-full h-[calc(100vh-4rem)] min-h-[320px] md:min-h-[520px] max-h-[780px] overflow-hidden bg-black"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSlide?.id || `slide-${activeIndex}`}
          className="absolute inset-0"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0.0, scale: 1.02 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          exit={reducedMotion ? { opacity: 1 } : { opacity: 0.0, scale: 1.0 }}
          transition={{ duration: reducedMotion ? 0 : 0.45, ease: 'easeOut' }}
        >
          <img
            src={resolveImageUrl(activeIndex)}
            alt={activeSlide?.title || 'Featured slide'}
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
            decoding="async"
            onError={() => {
              setPrimaryFailed((prev) => ({ ...prev, [activeIndex]: true }));
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent" />

          <div className="absolute inset-0 z-10 flex items-center justify-start px-4 sm:px-8 md:px-16">
            <div className="w-full max-w-4xl text-left">
              {activeSlide?.primaryCategory && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold uppercase tracking-wider text-primary">
                    {activeSlide.primaryCategory}
                  </span>
                  {activeSlide.secondaryCategories && activeSlide.secondaryCategories.length > 0 && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground line-clamp-1">
                        {activeSlide.secondaryCategories.slice(0, 3).join(" • ")}
                      </span>
                    </>
                  )}
                </div>
              )}

              <h1
                className="text-4xl md:text-6xl font-bold text-foreground mb-4"
                aria-live="polite"
                style={textShadowStyle}
              >
                {activeSlide?.title}
              </h1>

              {(activeSlide?.viewCount || activeSlide?.publishDate) && (
                <div className="flex items-center gap-4 text-foreground/90 mb-4">
                  {activeSlide.viewCount && (
                    <div className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      <span className="text-lg font-semibold">{activeSlide.viewCount}</span>
                    </div>
                  )}
                  {activeSlide.publishDate && (
                    <>
                      <span>•</span>
                      <span>{activeSlide.publishDate}</span>
                    </>
                  )}
                </div>
              )}

              {activeSlide?.description && (
                <p className="text-base md:text-lg text-foreground/90 line-clamp-3 mb-6">
                  {activeSlide.description}
                </p>
              )}
              
              {activeSlide?.title && (
                <div className="flex gap-4">
                  <Link href={activeSlide.buttonLink || `/video/${activeSlide.slug || activeSlide.id}`}>
                    <Button size="lg" className="gap-2 bg-white text-black hover:bg-white/90 border-none font-semibold px-8">
                      <Play className="h-5 w-5 fill-current" /> Watch Video
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <button
        type="button"
        onClick={() => goTo(activeIndex - 1)}
        aria-label="Previous slide"
        className="absolute z-20 left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 w-10 h-10 flex items-center justify-center"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => goTo(activeIndex + 1)}
        aria-label="Next slide"
        className="absolute z-20 right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 w-10 h-10 flex items-center justify-center"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2" role="tablist" aria-label="Slide selector">
        {slides.map((s, idx) => {
          const isActive = idx === activeIndex;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(idx)}
              className={cn(
                'h-2.5 w-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80',
                isActive ? 'bg-[#E50914] w-6' : 'bg-white/50 hover:bg-white/75',
              )}
              aria-label={`Go to slide ${idx + 1}`}
              aria-current={isActive ? 'true' : undefined}
            />
          );
        })}
      </div>

      <noscript>
        <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-5 gap-2 p-4">
          {slides.map((s, idx) => (
            <img
              key={s.id}
              src={s.imageUrl || FALLBACK_SLIDES[idx % FALLBACK_SLIDES.length].imageUrl}
              alt={s.title}
              className="w-full aspect-[16/9] object-cover"
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>
      </noscript>
    </section>
  );
};

export default React.memo(HeroImageSlider);
