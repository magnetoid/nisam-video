import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Clock, Eye, Play, Sparkles, TrendingUp } from 'lucide-react';
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
  badgeMode?: 'primary' | 'trending' | 'random' | 'latest' | 'popular';
};

function formatViewsLabel(viewCount?: string | null) {
  if (!viewCount) return null;
  const lower = viewCount.toLowerCase();
  if (lower.includes('view') || lower.includes('pregled') || lower.includes('преглед')) return viewCount;
  return `${viewCount} views`;
}

function formatPublishedLabel(publishDate?: string | null) {
  if (!publishDate) return null;
  const d = new Date(publishDate);
  if (Number.isNaN(d.getTime())) return publishDate;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 0) return publishDate;
  const days = Math.floor(seconds / 86400);
  if (days < 1) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

const HeroImageSlider: React.FC<Props> = ({ items, ariaLabel = 'Featured titles', badgeMode = 'primary' }) => {
  const reducedMotion = prefersReducedMotion();
  const textShadowStyle = useMemo(() => ({ textShadow: '1px 1px 2px rgba(0, 0, 0, 0.35)' }), []);

  const badge = useMemo(() => {
    if (badgeMode === 'trending') return { label: '#1 TRENDING', Icon: TrendingUp };
    if (badgeMode === 'popular') return { label: '#1 POPULAR', Icon: TrendingUp };
    if (badgeMode === 'latest') return { label: '#1 LATEST', Icon: Clock };
    if (badgeMode === 'random') return { label: 'RANDOM', Icon: Sparkles };
    return { label: 'FEATURED', Icon: TrendingUp };
  }, [badgeMode]);

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
      className="relative w-full h-[60vh] md:h-[75vh] overflow-hidden bg-black"
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
          <motion.div
            className="absolute inset-0 h-full w-full"
            initial={{ scale: 1 }}
            animate={{ scale: 1.1 }}
            transition={{ duration: 10, ease: "linear" }} // Ken Burns effect
          >
            <img
              src={resolveImageUrl(activeIndex)}
              alt={activeSlide?.title || 'Featured slide'}
              className="h-full w-full object-cover"
              loading="eager"
              decoding="async"
              onError={() => {
                setPrimaryFailed((prev) => ({ ...prev, [activeIndex]: true }));
              }}
            />
          </motion.div>

          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/20 to-transparent" />

          <div className="absolute bottom-0 left-0 w-full p-6 md:p-16 flex flex-col justify-end items-start z-10">
            <div className="w-full max-w-4xl text-left space-y-4 md:space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-3"
              >
                <span className="bg-primary text-primary-foreground px-3 py-1 text-xs md:text-sm font-bold uppercase tracking-wider rounded-md flex items-center gap-2">
                  <badge.Icon className="h-3 w-3 md:h-4 md:w-4" />
                  {badge.label}
                </span>
              </motion.div>

              <motion.h1
                className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-black text-white leading-[0.9] tracking-tighter"
                aria-live="polite"
                style={textShadowStyle}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {activeSlide?.title}
              </motion.h1>

              {(activeSlide?.viewCount || activeSlide?.publishDate) && (
                <motion.div 
                  className="flex items-center gap-4 text-white/90 font-medium text-sm md:text-base"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  {activeSlide.viewCount && (
                    <div className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      <span>{formatViewsLabel(activeSlide.viewCount)}</span>
                    </div>
                  )}
                  {activeSlide.publishDate && (
                    <>
                      <span className="text-white/50">•</span>
                      <span>{formatPublishedLabel(activeSlide.publishDate)}</span>
                    </>
                  )}
                </motion.div>
              )}

              {activeSlide?.description && (
                <motion.p 
                  className="text-sm md:text-lg text-white/80 line-clamp-2 max-w-2xl hidden md:block"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  {activeSlide.description}
                </motion.p>
              )}
              
              {activeSlide?.title && (
                <motion.div 
                  className="pt-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <Link href={`/video/${activeSlide.slug || activeSlide.id}`}>
                    <Button 
                      size="lg" 
                      className="gap-2 text-sm md:text-base h-12 md:h-14 px-8 bg-white text-black hover:bg-white/90 border-none font-bold shadow-xl shadow-black/20"
                    >
                      <Play className="h-5 w-5 fill-current" /> Play Now
                    </Button>
                  </Link>
                </motion.div>
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
