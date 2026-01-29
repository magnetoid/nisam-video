import { useQuery } from '@tanstack/react-query';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { HeroVideoWithVideo } from '../../../shared/schema'; // Adjust path
import { fetchWithAuth } from '@/lib/utils';
import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';

// Updated HeroBillboard to use carousel of 5 hero videos
export const HeroBillboard: React.FC = () => {
  const { data: heroVideos = [], isLoading } = useQuery({
    queryKey: ['hero-videos'],
    queryFn: () => fetchWithAuth('/api/admin/hero').then(res => res.json() as Promise<HeroVideoWithVideo[]>),
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Autoplay functionality disabled to resolve build issues - re-enable after dependency resolution
  // const autoplay = useRef(Autoplay({ 
  //   delay: 5000, 
  //   stopOnInteraction: true,
  //   stopOnMouseEnter: true,
  // })); // 5s autoplay, pause on hover

  // useEffect(() => {
  //   if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  //     autoplay.current.stop();
  //   }
  // }, []);

  if (isLoading) {
    return <div className="h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading hero carousel...</div>
    </div>;
  }

  if (heroVideos.length === 0) {
    return <div className="h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
      <div className="text-white text-xl">No hero videos configured. Visit admin to set up.</div>
    </div>;
  }

  return (
    <section className="relative h-screen w-full overflow-hidden" dir="ltr">
      <Carousel
        opts={{
          align: 'start',
          loop: true,
        }}
        // plugins={[autoplay.current]}
        className="h-full w-full"
      >
        <CarouselContent className="-ml-1 h-full w-full md:-ml-2">
          {heroVideos.map((hero) => (
            <CarouselItem key={hero.slot} className="pl-1 md:basis-1/2 lg:basis-1/3 h-full">
              <div className="relative h-full w-full rounded-lg overflow-hidden group cursor-pointer" 
                   onMouseEnter={() => autoplay.current.stop()} 
                   onMouseLeave={() => autoplay.current.play()}>
                {hero.video ? (
                  <>
                    <img 
                      src={hero.video.thumbnailUrl.replace('default.jpg', 'maxresdefault.jpg')} 
                      alt={hero.video.title} 
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <Badge variant="secondary" className="mb-2">{hero.video.channel?.name || 'Featured'}</Badge>
                      <h2 className="text-2xl md:text-4xl font-bold mb-2 leading-tight text-white">{hero.title}</h2>
                      <p className="text-lg md:text-xl mb-4 opacity-90 max-w-md line-clamp-3 text-white">{hero.description}</p>
                      <div className="flex items-center space-x-4">
                        <Button asChild size="lg" className="bg-white text-black hover:bg-gray-100">
                          <a href={hero.buttonLink || hero.video.embedUrl || `#/videos/${hero.video.slug}`}>
                            {hero.buttonText} <Play className="ml-2 h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full bg-gray-900">
                    <p className="text-white">No video configured for slot {hero.slot}</p>
                  </div>
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/20 backdrop-blur hover:bg-black/30 transition-all" />
        <CarouselNext className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/20 backdrop-blur hover:bg-black/30 transition-all" />
      </Carousel>
    </section>
  );
};

export default HeroBillboard;

