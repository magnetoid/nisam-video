import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, Filter, X, Play, Clock, Eye, Calendar as CalendarIcon, GripVertical, Plus, Image, Settings, Upload, Trash2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import type { VideoWithRelations } from '@shared/schema';
import { HeroVideoWithVideo, InsertHeroVideo, HeroImage, InsertHeroImage, HeroSettings, InsertHeroSettings, insertHeroSettingsSchema } from '@shared/schema';
import { format } from 'date-fns';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

interface HeroSlot extends InsertHeroVideo {
  video?: VideoWithRelations | null;
  tempId?: string; // For drag and drop of new items
}

interface HeroImageSlot extends InsertHeroImage {
  tempId?: string;
  isNew?: boolean;
}

type HeroTab = 'videos' | 'images' | 'settings';

export default function AdminHeroManagement() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<HeroTab>('videos');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [heroItems, setHeroItems] = useState<HeroSlot[]>([]);
  const [heroImages, setHeroImages] = useState<HeroImageSlot[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<HeroSlot | null>(null);
  const [editingImage, setEditingImage] = useState<HeroImageSlot | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isImageEditOpen, setIsImageEditOpen] = useState(false);

  const { data: videos = [], isLoading: videosLoading } = useQuery<VideoWithRelations[]>({
    queryKey: ['/api/videos', { search: searchTerm, type: filterType }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterType !== 'all') params.append('type', filterType);
      params.append('limit', '50');
      const res = await apiRequest('GET', `/api/videos?${params.toString()}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: heroVideosData = [], isLoading: heroLoading } = useQuery<HeroVideoWithVideo[]>({
    queryKey: ['/api/admin/hero'],
    queryFn: async () => {
        const res = await apiRequest('GET', '/api/admin/hero');
        return res.json();
    },
  });

  const { data: heroImagesData = [], isLoading: imagesLoading } = useQuery<HeroImage[]>({
    queryKey: ['/api/admin/hero/images'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/hero/images');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: heroSettingsData, isLoading: settingsLoading } = useQuery<HeroSettings>({
    queryKey: ['/api/admin/hero/config'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/admin/hero/config');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Initialize state from fetched data
  React.useEffect(() => {
    if (heroVideosData.length > 0) {
      setHeroItems(heroVideosData.map(h => ({
        ...h,
        tempId: h.id || Math.random().toString(36).substr(2, 9),
        // Ensure dates are converted to strings/Date objects as needed for inputs if using controlled inputs
        // For now, keep as is
      })));
    }
  }, [heroVideosData]);

  React.useEffect(() => {
    if (heroImagesData.length > 0) {
      setHeroImages(heroImagesData.map(img => ({
        ...img,
        tempId: img.id || Math.random().toString(36).substr(2, 9),
      })));
    }
  }, [heroImagesData]);

  const updateVideoMutation = useMutation({
    mutationFn: async (data: InsertHeroVideo[]) => {
      return apiRequest('POST', '/api/admin/hero', data);
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['/api/admin/hero'] });
      const previousHero = queryClient.getQueryData(['/api/admin/hero']);
      // Optimistic update? Maybe too complex with ID generation.
      // Let's just wait for success.
      return { previousHero };
    },
    onError: (err, newData, context) => {
      // queryClient.setQueryData(['/api/admin/hero'], context?.previousHero);
      toast.error('Failed to save hero videos');
    },
    onSuccess: () => {
      toast.success('Hero videos updated successfully');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/hero'] });
      queryClient.invalidateQueries({ queryKey: ['/api/videos/hero'] }); // Public cache
    },
    onSettled: () => {
      setIsSaving(false);
    }
  });

  const updateImageMutation = useMutation({
    mutationFn: async (data: InsertHeroImage[]) => {
      return apiRequest('POST', '/api/admin/hero/images', data);
    },
    onSuccess: () => {
      toast.success('Hero images updated successfully');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/hero/images'] });
    },
    onError: () => {
      toast.error('Failed to save hero images');
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<InsertHeroSettings>) => {
      return apiRequest('POST', '/api/admin/hero/config', data);
    },
    onSuccess: () => {
      toast.success('Hero settings updated successfully');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/hero/config'] });
    },
    onError: () => {
      toast.error('Failed to save hero settings');
    }
  });

  const handleSelectVideo = useCallback((video: VideoWithRelations) => {
    const newItem: HeroSlot = {
      videoId: video.id,
      title: video.title,
      description: video.description || '',
      buttonText: 'Watch Now',
      buttonLink: `/video/${video.slug || video.id}`,
      displayOrder: heroItems.length,
      isActive: 1,
      thumbnailUrl: video.thumbnailUrl,
      video: video,
      tempId: Math.random().toString(36).substr(2, 9)
    };
    
    setHeroItems(prev => [...prev, newItem]);
    toast.success('Video added to slider');
    setIsDialogOpen(false);
  }, [heroItems]);

  const handleAddImage = useCallback((imageData: Omit<InsertHeroImage, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newImage: HeroImageSlot = {
      ...imageData,
      tempId: Math.random().toString(36).substr(2, 9),
      isNew: true,
    };
    setHeroImages(prev => [...prev, newImage]);
    toast.success('Image added to hero collection');
    setIsImageDialogOpen(false);
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    setHeroImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleReorderImages = useCallback((sourceIndex: number, destinationIndex: number) => {
    const newImages = [...heroImages];
    const [moved] = newImages.splice(sourceIndex, 1);
    newImages.splice(destinationIndex, 0, moved);
    setHeroImages(newImages);
  }, [heroImages]);

  const handleSaveImages = useCallback(() => {
    const dataToSave: InsertHeroImage[] = heroImages.map(img => ({
      ...img,
      id: img.id || undefined, // Keep existing ID if present
    }));
    updateImageMutation.mutate(dataToSave);
  }, [heroImages, updateImageMutation]);

  const handleSaveSettings = useCallback((data: Partial<InsertHeroSettings>) => {
    updateSettingsMutation.mutate(data);
  }, [updateSettingsMutation]);

  const settingsForm = useForm<Partial<InsertHeroSettings>>({
    resolver: zodResolver(insertHeroSettingsSchema.partial()),
    defaultValues: heroSettingsData || {
      fallbackImages: [],
      rotationInterval: 4000,
      animationType: 'fade',
      defaultPlaceholderUrl: '',
      enableRandom: true,
      enableImages: true,
    },
  });

  React.useEffect(() => {
    if (heroSettingsData) {
      settingsForm.reset(heroSettingsData);
    }
  }, [heroSettingsData, settingsForm]);

  const handleRemoveItem = useCallback((index: number) => {
    setHeroItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleReorder = useCallback((sourceIndex: number, destinationIndex: number) => {
    const newItems = [...heroItems];
    const [moved] = newItems.splice(sourceIndex, 1);
    newItems.splice(destinationIndex, 0, moved);
    // Update displayOrder
    newItems.forEach((item, index) => {
      item.displayOrder = index;
    });
    setHeroItems(newItems);
  }, [heroItems]);

  const handleSaveVideos = useCallback(() => {
    setIsSaving(true);
    // Prepare data for API
    const dataToSave: InsertHeroVideo[] = heroItems.map((item, index) => ({
      videoId: item.videoId,
      title: item.title,
      description: item.description,
      buttonText: item.buttonText,
      buttonLink: item.buttonLink,
      displayOrder: index,
      thumbnailUrl: item.thumbnailUrl,
      videoUrl: item.videoUrl,
      duration: item.duration,
      startDate: item.startDate ? new Date(item.startDate) : undefined, // Ensure Date object
      endDate: item.endDate ? new Date(item.endDate) : undefined,
      isActive: item.isActive
    }));
    updateVideoMutation.mutate(dataToSave);
  }, [heroItems, updateVideoMutation]);

  const handleEditItem = (item: HeroSlot) => {
    setEditingItem({ ...item });
    setIsEditOpen(true);
  };

  const saveEditedItem = () => {
    if (!editingItem) return;
    setHeroItems(prev => prev.map(item => 
      (item.tempId === editingItem.tempId || (item.id && item.id === editingItem.id)) ? editingItem : item
    ));
    setIsEditOpen(false);
    setEditingItem(null);
  };

  const handleEditImage = (image: HeroImageSlot) => {
    setEditingImage({ ...image });
    setIsImageEditOpen(true);
  };

  const saveEditedImage = () => {
    if (!editingImage) return;
    setHeroImages(prev => prev.map(img => 
      (img.tempId === editingImage.tempId || (img.id && img.id === editingImage.id)) ? editingImage : img
    ));
    setIsImageEditOpen(false);
    setEditingImage(null);
  };

  const filteredVideos = videos.filter(v => 
    !heroItems.some(s => s.videoId === v.id) &&
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
        </div>
      </div>
    </Card>
  );

  const ImageItem = ({ image, onEdit, onDelete }: { image: HeroImageSlot; onEdit: (i: HeroImageSlot) => void; onDelete: (i: number) => void }) => (
    <Draggable draggableId={image.tempId || image.id || `img-${Math.random()}`} index={0}>
      {(provided, snapshot) => (
        <Card 
          ref={provided.innerRef} 
          {...provided.draggableProps} 
          className={`p-4 ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''}`}
        >
          <div className="flex items-start gap-4">
            <div {...provided.dragHandleProps} className="pt-1 text-muted-foreground hover:text-foreground cursor-grab">
              <GripVertical className="h-5 w-5" />
            </div>
            <div className="relative w-32 h-20 shrink-0">
              <img 
                src={image.url} 
                alt={image.alt || 'Hero image'} 
                className="w-full h-full object-cover rounded" 
                onError={(e) => { e.currentTarget.src = '/placeholder.jpg'; }}
              />
              {!image.isActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded">
                  <Badge variant="secondary">Inactive</Badge>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium truncate">{image.alt || 'Untitled Image'}</h4>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => onEdit(image)}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(0)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Aspect: {image.aspectRatio}</p>
            </div>
          </div>
        </Card>
      )}
    </Draggable>
  );

  const PreviewItem = ({ item, index }: { item: HeroSlot; index: number }) => {
    return (
      <Draggable draggableId={item.tempId || item.id || `item-${index}`} index={index}>
        {(provided, snapshot) => (
          <Card 
            ref={provided.innerRef} 
            {...provided.draggableProps} 
            className={`flex gap-4 p-4 ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''} items-center`}
          >
            <div {...provided.dragHandleProps} className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing">
                <GripVertical className="h-5 w-5" />
            </div>
            
            <div className="relative w-32 h-20 shrink-0">
                <img 
                    src={item.thumbnailUrl || item.video?.thumbnailUrl || '/placeholder.jpg'} 
                    alt={item.title} 
                    className={`w-full h-full object-cover rounded ${item.isActive ? '' : 'opacity-50 grayscale'}`} 
                />
                {!item.isActive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded">
                        <Badge variant="secondary">Inactive</Badge>
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium truncate">{item.title}</h4>
                {item.startDate && new Date(item.startDate) > new Date() && (
                    <Badge variant="outline" className="text-xs">Scheduled</Badge>
                )}
                {item.endDate && new Date(item.endDate) < new Date() && (
                    <Badge variant="destructive" className="text-xs">Expired</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1">{item.description}</p>
              <div className="text-xs text-muted-foreground flex gap-2">
                 {item.startDate && <span>Start: {format(new Date(item.startDate), 'MMM d, yyyy')}</span>}
                 {item.endDate && <span>End: {format(new Date(item.endDate), 'MMM d, yyyy')}</span>}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleEditItem(item)}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(index)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}
      </Draggable>
    );
  };

  const SettingsForm = () => {
    const onSubmit = settingsForm.handleSubmit(handleSaveSettings);

    return (
      <Card>
        <CardHeader>
          <CardTitle>Slider Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label>Rotation Interval (seconds)</Label>
            <div className="flex items-center gap-4">
              <Slider
                defaultValue={[4]}
                min={3}
                max={5}
                step={1}
                onValueChange={(value) => settingsForm.setValue('rotationInterval', value[0] * 1000)}
                className="w-full"
              />
              <span className="w-8 text-center">{settingsForm.watch('rotationInterval') ? settingsForm.watch('rotationInterval') / 1000 : 4}s</span>
            </div>
          </div>

          <div className="space-y-4">
            <Label>Animation Type</Label>
            <Select 
              value={settingsForm.watch('animationType') || 'fade'} 
              onValueChange={(value) => settingsForm.setValue('animationType', value as 'fade' | 'slide')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fade">Fade</SelectItem>
                <SelectItem value="slide">Slide</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fallback Images (URLs, one per line)</Label>
            <textarea
              className="w-full h-24 p-3 border rounded-md"
              placeholder="Enter fallback image URLs, one per line"
              value={(settingsForm.watch('fallbackImages') || []).join('\n')}
              onChange={(e) => {
                const urls = e.target.value.split('\n').map(url => url.trim()).filter(Boolean);
                settingsForm.setValue('fallbackImages', urls);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Default Placeholder URL</Label>
            <Input
              placeholder="https://example.com/placeholder.jpg"
              {...settingsForm.register('defaultPlaceholderUrl')}
            />
          </div>

          <div className="flex gap-8">
            <div className="flex items-center space-x-2">
              <Switch 
                checked={settingsForm.watch('enableRandom') || false}
                onCheckedChange={(checked) => settingsForm.setValue('enableRandom', checked)}
              />
              <Label>Enable Random Selection</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                checked={settingsForm.watch('enableImages') || false}
                onCheckedChange={(checked) => settingsForm.setValue('enableImages', checked)}
              />
              <Label>Use Image Slider (vs Videos)</Label>
            </div>
          </div>

          <Button onClick={onSubmit} className="w-full">
            Save Settings
          </Button>

          {/* Preview Section */}
          <div className="space-y-4">
            <Label>Live Preview</Label>
            <Card className="aspect-video w-full">
              <CardContent className="p-0 h-full">
                {/* Simple preview - fetch random for demo */}
                {settingsLoading ? (
                  <div className="flex items-center justify-center h-full bg-muted">
                    Loading preview...
                  </div>
                ) : (
                  <div className="relative h-full bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Image className="h-12 w-12 mx-auto mb-2" />
                      <p>Slider Preview</p>
                      <p className="text-sm">Interval: {settingsForm.watch('rotationInterval') / 1000}s</p>
                      <p className="text-sm">Animation: {settingsForm.watch('animationType')}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 p-8 ml-[240px] pt-16">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Hero Management</h1>
              <p className="text-muted-foreground">Configure videos, images, and slider settings</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as HeroTab)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="videos">
                <Play className="h-4 w-4 mr-2" />
                Videos
              </TabsTrigger>
              <TabsTrigger value="images">
                <Image className="h-4 w-4 mr-2" />
                Images
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </TabsTrigger>
            </TabsList>

            {/* Videos Tab */}
            <TabsContent value="videos" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Video Slider</h2>
                  <p className="text-muted-foreground">Manage featured video slides</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" /> Add Video
                  </Button>
                  <Button onClick={handleSaveVideos} disabled={isSaving || heroItems.length === 0} variant="default">
                    {isSaving ? 'Saving...' : 'Save Videos'}
                  </Button>
                </div>
              </div>

              {heroLoading ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Loading videos...</p>
                  </CardContent>
                </Card>
              ) : heroItems.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No video slides</h3>
                    <p className="text-muted-foreground mb-4">Add videos to create a video-based hero slider</p>
                    <Button onClick={() => setIsDialogOpen(true)}>Add First Video</Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <DragDropContext onDragEnd={(result) => {
                    if (!result.destination) return;
                    handleReorder(result.source.index, result.destination.index);
                  }}>
                    <Droppable droppableId="hero-videos">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                          {heroItems.map((item, index) => (
                            <PreviewItem key={item.tempId || item.id} item={item} index={index} />
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>
              )}

              {/* Add Video Dialog */}
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Video to Slider</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search videos..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Filter type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Videos</SelectItem>
                          <SelectItem value="regular">Regular</SelectItem>
                          <SelectItem value="youtube_short">Shorts</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto p-1">
                      {videosLoading ? (
                        <p className="col-span-full text-center py-8">Loading videos...</p>
                      ) : filteredVideos.length === 0 ? (
                        <p className="col-span-full text-center py-8 text-muted-foreground">No videos found</p>
                      ) : (
                        filteredVideos.map((video) => (
                          <VideoItem key={video.id} video={video} onSelect={handleSelectVideo} />
                        ))
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Edit Video Dialog */}
              <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Video Slide</DialogTitle>
                    </DialogHeader>
                    {editingItem && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Title</Label>
                                    <Input 
                                        value={editingItem.title} 
                                        onChange={(e) => setEditingItem({...editingItem, title: e.target.value})} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <div className="flex items-center space-x-2 pt-2">
                                        <Switch 
                                            checked={editingItem.isActive === 1} 
                                            onCheckedChange={(checked) => setEditingItem({...editingItem, isActive: checked ? 1 : 0})} 
                                        />
                                        <span>{editingItem.isActive ? 'Active' : 'Inactive'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Input 
                                    value={editingItem.description} 
                                    onChange={(e) => setEditingItem({...editingItem, description: e.target.value})} 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Button Text</Label>
                                    <Input 
                                        value={editingItem.buttonText} 
                                        onChange={(e) => setEditingItem({...editingItem, buttonText: e.target.value})} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Button Link</Label>
                                    <Input 
                                        value={editingItem.buttonLink} 
                                        onChange={(e) => setEditingItem({...editingItem, buttonLink: e.target.value})} 
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Custom Video URL (Optional)</Label>
                                <Input 
                                    value={editingItem.videoUrl || ''} 
                                    onChange={(e) => setEditingItem({...editingItem, videoUrl: e.target.value})} 
                                    placeholder="https://..."
                                />
                                <p className="text-xs text-muted-foreground">Overrides the linked video content</p>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Custom Thumbnail URL (Optional)</Label>
                                <Input 
                                    value={editingItem.thumbnailUrl || ''} 
                                    onChange={(e) => setEditingItem({...editingItem, thumbnailUrl: e.target.value})} 
                                    placeholder="https://..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Date (Optional)</Label>
                                    <Input 
                                        type="datetime-local"
                                        value={editingItem.startDate ? new Date(editingItem.startDate).toISOString().slice(0, 16) : ''}
                                        onChange={(e) => setEditingItem({
                                            ...editingItem, 
                                            startDate: e.target.value ? new Date(e.target.value) : null
                                        })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date (Optional)</Label>
                                    <Input 
                                        type="datetime-local"
                                        value={editingItem.endDate ? new Date(editingItem.endDate).toISOString().slice(0, 16) : ''}
                                        onChange={(e) => setEditingItem({
                                            ...editingItem, 
                                            endDate: e.target.value ? new Date(e.target.value) : null
                                        })}
                                    />
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                                <Button onClick={saveEditedItem}>Update Slide</Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* Images Tab */}
            <TabsContent value="images" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Image Collection</h2>
                  <p className="text-muted-foreground">Manage hero images for the slider</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setIsImageDialogOpen(true)} className="gap-2">
                    <Upload className="h-4 w-4" /> Add Image
                  </Button>
                  <Button onClick={handleSaveImages} disabled={isSaving || heroImages.length === 0} variant="default">
                    Save Images
                  </Button>
                </div>
              </div>

              {imagesLoading ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Loading images...</p>
                  </CardContent>
                </Card>
              ) : heroImages.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Image className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No images added</h3>
                    <p className="text-muted-foreground mb-4">Add images to enable image-based hero slider</p>
                    <Button onClick={() => setIsImageDialogOpen(true)}>Add First Image</Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <DragDropContext onDragEnd={(result) => {
                    if (!result.destination) return;
                    handleReorderImages(result.source.index, result.destination.index);
                  }}>
                    <Droppable droppableId="hero-images">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {heroImages.map((image, index) => (
                            <ImageItem 
                              key={image.tempId || image.id} 
                              image={image} 
                              onEdit={handleEditImage}
                              onDelete={() => handleRemoveImage(index)}
                            />
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>
              )}

              {/* Add Image Dialog - Simple URL input for now */}
              <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Hero Image</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Image URL</Label>
                      <Input 
                        placeholder="https://example.com/image.jpg"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const url = e.currentTarget.value.trim();
                            if (url) {
                              handleAddImage({
                                url,
                                alt: '',
                                aspectRatio: '16:9',
                                isActive: true,
                              });
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground">Press Enter to add. Supports direct URLs.</p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsImageDialogOpen(false)}>Cancel</Button>
                    </DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Edit Image Dialog */}
              <Dialog open={isImageEditOpen} onOpenChange={setIsImageEditOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Hero Image</DialogTitle>
                  </DialogHeader>
                  {editingImage && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Image URL</Label>
                        <Input 
                          value={editingImage.url} 
                          onChange={(e) => setEditingImage({...editingImage, url: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Alt Text</Label>
                        <Input 
                          value={editingImage.alt || ''} 
                          onChange={(e) => setEditingImage({...editingImage, alt: e.target.value})} 
                          placeholder="Descriptive alt text for accessibility"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Aspect Ratio</Label>
                        <Select 
                          value={editingImage.aspectRatio || '16:9'} 
                          onValueChange={(value) => setEditingImage({...editingImage, aspectRatio: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="16:9">16:9 (Wide)</SelectItem>
                            <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                            <SelectItem value="1:1">1:1 (Square)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2 pt-2">
                        <Switch 
                          checked={editingImage.isActive} 
                          onCheckedChange={(checked) => setEditingImage({...editingImage, isActive: checked})} 
                        />
                        <Label>Active</Label>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsImageEditOpen(false)}>Cancel</Button>
                        <Button onClick={saveEditedImage}>Update Image</Button>
                      </DialogFooter>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <SettingsForm />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
