import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, Filter, X, Play, Clock, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import type { VideoWithRelations } from '@shared/schema';
import { HeroVideoWithVideo, InsertHeroVideo } from '@shared/schema';

const MAX_HERO_VIDEOS = 5;

interface HeroSlot extends InsertHeroVideo {
  video: VideoWithRelations;
}

export default function AdminHeroManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedVideos, setSelectedVideos] = useState<HeroSlot[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: videos = [], isLoading: videosLoading } = useQuery<VideoWithRelations[]>({
    queryKey: ['/api/videos', { search: searchTerm, type: filterType }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterType !== 'all') params.append('type', filterType);
      params.append('limit', '50');
      const response = await apiRequest('GET', `/api/videos?${params.toString()}`);
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: heroVideos = [], isLoading: heroLoading } = useQuery<HeroVideoWithVideo[]>({
    queryKey: ['/api/admin/hero'],
    queryFn: () => apiRequest('GET', '/api/admin/hero'),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertHeroVideo[]) => {
      return apiRequest('POST', '/api/admin/hero', data);
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['/api/admin/hero'] });
      const previousHero = queryClient.getQueryData(['/api/admin/hero']);
      queryClient.setQueryData(['/api/admin/hero'], () => newData.map(d => ({ ...d, video: selectedVideos.find(s => s.videoId === d.videoId)?.video || null })));
      return { previousHero };
    },
    onError: (err, newData, context) => {
      queryClient.setQueryData(['/api/admin/hero'], context?.previousHero);
      toast.error('Failed to save hero videos');
    },
    onSuccess: () => {
      toast.success('Hero videos updated successfully');
      setIsDialogOpen(false);
      setSelectedVideos([]);
    },
  });

  const handleSelectVideo = useCallback((video: VideoWithRelations) => {
    if (selectedVideos.length >= MAX_HERO_VIDEOS) {
      toast.error(`Maximum ${MAX_HERO_VIDEOS} videos allowed`);
      return;
    }
    if (selectedVideos.some(s => s.video.id === video.id)) {
      toast.info('Video already selected');
      return;
    }
    const newSlot = { ...selectedVideos[selectedVideos.length] || { slot: selectedVideos.length + 1 }, videoId: video.id, title: video.title, description: video.description || '', buttonText: 'Watch Now', buttonLink: `/videos/${video.slug}` };
    setSelectedVideos(prev => [...prev, newSlot]);
    toast.success('Video selected');
  }, [selectedVideos]);

  const handleDeselectVideo = useCallback((index: number) => {
    setSelectedVideos(prev => prev.filter((_, i) => i !== index));
    toast.info('Video deselected');
  }, []);

  const handleReorder = useCallback((sourceIndex: number, destinationIndex: number) => {
    const newSelected = [...selectedVideos];
    const [moved] = newSelected.splice(sourceIndex, 1);
    newSelected.splice(destinationIndex, 0, moved);
    // Update slots
    newSelected.forEach((item, index) => {
      item.slot = index + 1;
    });
    setSelectedVideos(newSelected);
  }, [selectedVideos]);

  const handleSave = useCallback(() => {
    if (selectedVideos.length !== MAX_HERO_VIDEOS) {
      toast.error(`Please select exactly ${MAX_HERO_VIDEOS} videos`);
      return;
    }
    setIsSaving(true);
    updateMutation.mutate(selectedVideos);
  }, [selectedVideos, updateMutation]);

  const filteredVideos = videos.filter(v => 
    !selectedVideos.some(s => s.videoId === v.id) &&
    (searchTerm === '' || v.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const VideoItem = ({ video, onSelect }: { video: VideoWithRelations; onSelect: (v: VideoWithRelations) => void }) => (
    <Card className="flex gap-4 p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelect(video)} role="button" tabIndex={0} aria-label={`Select ${video.title}`}>
      <img src={video.thumbnailUrl} alt={video.title} className="w-24 h-16 object-cover rounded" loading="lazy" />
      <div className="flex-1 min-w-0">
        <h3 className="font-medium line-clamp-2">{video.title}</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
          <Clock className="h-3 w-3" />
          <span>{video.duration || 'N/A'}</span>
          <Eye className="h-3 w-3" />
          <span>{video.viewCount || '0 views'}</span>
        </div>
        <div className="flex gap-2 mt-2 text-xs">
          {video.categories.slice(0, 2).map(cat => (
            <Badge key={cat.id} variant="secondary">{cat.name}</Badge>
          ))}
        </div>
      </div>
    </Card>
  );

  const PreviewItem = ({ slot, onRemove, index }: { slot: HeroSlot; onRemove: (i: number) => void; index: number }) => {
    const [{ isDragging }, drag] = useDrag({
      type: 'hero-slot',
      item: { index },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    const [, drop] = useDrop({
      accept: 'hero-slot',
      hover: (item: { index: number }) => {
        if (item.index !== index) {
          handleReorder(item.index, index);
          item.index = index;
        }
      },
    });

    const ref = useCallback((node: HTMLDivElement | null) => {
      drag(drop(node));
    }, [drag, drop]);

    return (
      <Draggable draggableId={slot.videoId} index={index}>
        {(provided, snapshot) => (
          <Card ref={ref} {...provided.draggableProps} className={`flex gap-4 p-4 ${snapshot.isDragging ? 'shadow-lg' : ''}`} {...provided.dragHandleProps}>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{slot.slot}</Badge>
              <Button variant="ghost" size="sm" onClick={() => onRemove(index)} aria-label="Remove video">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <img src={slot.video.thumbnailUrl} alt={slot.video.title} className="w-32 h-20 object-cover rounded" />
            <div className="flex-1">
              <h4 className="font-medium">{slot.video.title}</h4>
              <p className="text-sm text-muted-foreground line-clamp-2">{slot.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={slot.buttonLink} target="_blank" rel="noopener noreferrer">
                    {slot.buttonText}
                  </a>
                </Button>
              </div>
            </div>
          </Card>
        )}
      </Draggable>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 p-8 ml-[240px] pt-16">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Hero Slider Management</h1>
              <p className="text-muted-foreground">Select exactly 5 videos to feature in the main hero carousel</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">{selectedVideos.length}/{MAX_HERO_VIDEOS} selected</Badge>
              <Button onClick={() => setIsDialogOpen(true)} disabled={selectedVideos.length !== MAX_HERO_VIDEOS}>
                {selectedVideos.length === MAX_HERO_VIDEOS ? 'Edit Selection' : 'Select Videos'}
              </Button>
            </div>
          </div>

          {heroLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Loading hero videos...</p>
              </CardContent>
            </Card>
          ) : selectedVideos.length === 0 && heroVideos.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hero videos configured</h3>
                <p className="text-muted-foreground mb-4">Select 5 videos to create an engaging hero slider</p>
                <Button onClick={() => setIsDialogOpen(true)}>Configure Hero Slider</Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Current Hero Selection</CardTitle>
                <p className="text-muted-foreground">Drag to reorder videos in the carousel</p>
              </CardHeader>
              <CardContent>
                <DragDropContext onDragEnd={(result) => {
                  if (!result.destination) return;
                  handleReorder(result.source.index, result.destination.index);
                }}>
                  <Droppable droppableId="hero-slots">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                        {selectedVideos.map((slot, index) => (
                          <PreviewItem key={slot.videoId} slot={slot} onRemove={handleDeselectVideo} index={index} />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </CardContent>
            </Card>
          )}

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Select Hero Videos</DialogTitle>
                <p className="text-muted-foreground">Choose up to 5 videos from your library. Search and filter to find the perfect content.</p>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search videos by title or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Videos</SelectItem>
                      <SelectItem value="regular">Regular Videos</SelectItem>
                      <SelectItem value="youtube_short">YouTube Shorts</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {videosLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Card key={i} className="animate-pulse">
                        <CardContent className="p-4 space-y-4">
                          <div className="w-24 h-16 bg-muted rounded"></div>
                          <div className="space-y-2">
                            <div className="h-4 bg-muted rounded w-3/4"></div>
                            <div className="h-3 bg-muted rounded w-1/2"></div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : filteredVideos.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No videos found</h3>
                      <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredVideos.map((video) => (
                      <VideoItem key={video.id} video={video} onSelect={handleSelectVideo} />
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter className="flex justify-between">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedVideos([])} disabled={selectedVideos.length === 0}>
                    Clear All
                  </Button>
                  <Button onClick={handleSave} disabled={selectedVideos.length !== MAX_HERO_VIDEOS || isSaving}>
                    {isSaving ? 'Saving...' : 'Save Selection'}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}