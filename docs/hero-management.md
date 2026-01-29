# Hero Video Management Documentation

## Overview

The Hero Video Management system allows administrators to curate a featured carousel of exactly 5 videos that appear prominently on the homepage. This system provides a drag-and-drop interface for selecting, configuring, and ordering videos to showcase the most important content.

## Architecture

### Database Schema

The system uses a dedicated table for hero video configuration:

```sql
heroVideos (
  id UUID PRIMARY KEY,
  slot INTEGER UNIQUE, -- 1 to 5, enforces exactly 5 slots
  videoId UUID REFERENCES videos(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  buttonText TEXT NOT NULL,
  buttonLink TEXT NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
)
```

### Key Constraints

- **Slot Uniqueness**: Each hero video occupies a specific slot (1-5)
- **Video Relationship**: Foreign key relationship with videos table
- **Cascade Behavior**: When a video is deleted, hero entries are set to NULL
- **Exact Count**: Validation ensures exactly 5 hero videos are configured

## Implementation

### Backend API

#### Endpoints

1. **GET /api/admin/hero**
   - Retrieves all currently configured hero videos
   - Returns videos ordered by slot number
   - Includes associated video data for display

2. **POST /api/admin/hero**
   - Updates the entire hero video configuration
   - Accepts array of exactly 5 hero video objects
   - Validates slot numbers and video IDs
   - Replaces existing configuration entirely

#### Validation Rules

- Exactly 5 hero video entries must be provided
- Slot numbers must be unique integers from 1 to 5
- All video IDs must reference existing videos
- Title, description, buttonText, and buttonLink are required

### Frontend Components

#### Admin Interface (`AdminHeroManagement.tsx`)

The admin interface provides a comprehensive management experience:

##### Features

1. **Video Selection**
   - Search and filter videos from the entire library
   - Visual preview of video thumbnails and metadata
   - Limit enforcement (exactly 5 videos)

2. **Drag-and-Drop Ordering**
   - Intuitive reordering of selected videos
   - Visual feedback during drag operations
   - Automatic slot number updates

3. **Content Customization**
   - Editable titles, descriptions, and button text
   - Customizable button links
   - Real-time preview of changes

4. **Responsive Design**
   - Works on desktop and tablet devices
   - Touch-friendly controls for mobile management
   - Adaptive layouts for different screen sizes

##### Component Structure

```jsx
// Main component structure
<AdminHeroManagement>
  <HeroSelectionDialog />     // Video selection modal
  <HeroPreviewList />         // Current selection display
  <VideoItem />               // Individual video selector
  <PreviewItem />             // Individual preview item
</AdminHeroManagement>
```

#### Frontend Display (`HeroBillboard.tsx`)

The frontend display component renders the hero carousel:

##### Features

1. **Carousel Functionality**
   - Auto-play with 5-second intervals
   - Pause on hover for better user experience
   - Manual navigation controls
   - Responsive slide sizing

2. **Accessibility**
   - Keyboard navigation support
   - Screen reader compatibility
   - Reduced motion preference respect
   - Proper focus management

3. **Visual Design**
   - Gradient overlays for text readability
   - Hover animations for interactivity
   - High-quality thumbnail optimization
   - Consistent branding and styling

##### Component Structure

```jsx
// Billboard component structure
<HeroBillboard>
  <Carousel>                  // Main carousel container
    <CarouselItem />          // Individual hero slides
    <CarouselNavigation />    // Previous/next controls
  </Carousel>
</HeroBillboard>
```

## Storage Layer Integration

### DatabaseStorage Methods

The storage layer provides specific methods for hero video management:

#### `getHeroVideos()`

Retrieves all configured hero videos with associated video data:

```javascript
async getHeroVideos(): Promise<HeroVideoWithVideo[]> {
  // Query joins heroVideos with videos table
  // Returns ordered results (slots 1-5)
  // Handles missing videos gracefully
}
```

#### `updateHeroVideos(heroVideos: InsertHeroVideo[])`

Updates the entire hero video configuration:

```javascript
async updateHeroVideos(heroVideos: InsertHeroVideo[]): Promise<HeroVideoWithVideo[]> {
  // Validates exactly 5 entries
  // Checks slot uniqueness (1-5)
  // Verifies video ID existence
  // Replaces all existing entries
  // Clears cache and returns updated data
}
```

### Caching Strategy

Hero video data is cached for performance optimization:

- **Cache Key**: `hero:videos`
- **TTL**: 5 minutes (300,000 ms)
- **Invalidation**: Automatic on updates
- **Fallback**: Direct database query on cache miss

## User Experience

### Admin Workflow

1. **Access**: Navigate to Admin → Hero Management
2. **Current State**: View currently configured hero videos
3. **Edit Mode**: Click "Edit Selection" or "Configure Hero Slider"
4. **Video Selection**: Search/filter and select exactly 5 videos
5. **Customization**: Edit titles, descriptions, button text/links
6. **Ordering**: Drag-and-drop to arrange video order
7. **Save**: Confirm changes to update hero configuration

### Frontend Display

1. **Auto-Play**: Carousel automatically advances every 5 seconds
2. **Hover Pause**: Animation pauses when user hovers over content
3. **Manual Navigation**: Users can navigate forward/backward
4. **Responsive**: Adapts to different screen sizes and devices
5. **Loading States**: Graceful handling of loading and error states

## Security Considerations

### Authentication

All hero management endpoints require authentication:

```javascript
router.get("/hero", requireAuth, async (_req, res) => {
  // Only authenticated admins can access
});

router.post("/hero", requireAuth, async (req, res) => {
  // Only authenticated admins can modify
});
```

### Input Validation

API endpoints implement strict validation:

- **Slot Validation**: Ensures exactly 5 slots numbered 1-5
- **Video ID Validation**: Confirms referenced videos exist
- **Content Validation**: Checks required fields are present
- **Length Limits**: Enforces reasonable content length limits

## Performance Optimization

### Database Queries

Efficient querying strategies:

1. **Single Query**: Get all hero videos in one database call
2. **Joins**: Pre-fetch associated video data to minimize queries
3. **Indexing**: Database indexes on slot and videoId columns
4. **Connection Pooling**: Reuse database connections

### Frontend Optimization

Client-side performance enhancements:

1. **Caching**: Cache hero video data for 5 minutes
2. **Lazy Loading**: Load carousel images progressively
3. **Bundle Splitting**: Separate hero components for faster initial load
4. **Memoization**: Prevent unnecessary re-renders

## Error Handling

### Common Error Scenarios

1. **Validation Errors**
   - Wrong number of hero videos
   - Duplicate or invalid slot numbers
   - Non-existent video IDs

2. **Database Errors**
   - Connection failures
   - Constraint violations
   - Transaction rollbacks

3. **Frontend Errors**
   - Network failures
   - Rendering issues
   - User interaction problems

### Recovery Strategies

1. **Graceful Degradation**: Show error messages without breaking the UI
2. **Retry Logic**: Automatically retry failed operations
3. **Fallback Content**: Display default content when hero videos unavailable
4. **Admin Notifications**: Alert administrators to persistent issues

## API Documentation

### GET /api/admin/hero

**Description**: Retrieve all configured hero videos

**Response**:
```json
[
  {
    "id": "uuid",
    "slot": 1,
    "videoId": "video-uuid",
    "title": "Featured Video Title",
    "description": "Compelling description",
    "buttonText": "Watch Now",
    "buttonLink": "/videos/slug",
    "createdAt": "timestamp",
    "updatedAt": "timestamp",
    "video": {
      // Associated video data
    }
  }
]
```

### POST /api/admin/hero

**Description**: Update hero video configuration

**Request Body**:
```json
[
  {
    "slot": 1,
    "videoId": "video-uuid",
    "title": "Featured Video Title",
    "description": "Compelling description",
    "buttonText": "Watch Now",
    "buttonLink": "/videos/slug"
  }
  // ... 4 more entries (exactly 5 total)
]
```

**Response**:
```json
{
  "success": true,
  "heroVideos": [
    // Updated hero video data
  ]
}
```

## Best Practices

### Content Guidelines

1. **Video Selection**
   - Choose high-quality, engaging content
   - Ensure diverse representation
   - Consider seasonal relevance
   - Prioritize popular or trending videos

2. **Text Content**
   - Keep titles concise and compelling
   - Use descriptive, keyword-rich descriptions
   - Create clear call-to-action button text
   - Ensure accessibility compliance

3. **Visual Consistency**
   - Select videos with similar aspect ratios
   - Consider color schemes and visual themes
   - Maintain consistent branding
   - Optimize thumbnails for clarity

### Administration

1. **Regular Updates**
   - Rotate hero videos periodically
   - Update content for seasonal relevance
   - Monitor performance metrics
   - Gather user feedback

2. **Performance Monitoring**
   - Track click-through rates
   - Monitor load times
   - Analyze user engagement
   - Review error logs

## Future Enhancements

### Planned Features

1. **Analytics Integration**
   - Track hero video performance
   - Measure click-through rates
   - A/B testing capabilities
   - User engagement metrics

2. **Advanced Scheduling**
   - Time-based hero video rotation
   - Event-driven content changes
   - Automated seasonal updates
   - Personalized recommendations

3. **Enhanced Customization**
   - Rich text editing for descriptions
   - Custom styling options
   - Overlay effects and animations
   - Branding customization

4. **Multi-Variant Support**
   - Different heroes for different user segments
   - Geographic targeting
   - Device-specific optimizations
   - Language-specific content

## Maintenance

### Regular Tasks

1. **Content Updates**
   - Monthly review of hero video selections
   - Quarterly performance analysis
   - Seasonal content adjustments
   - Trending content identification

2. **Technical Maintenance**
   - Cache monitoring and optimization
   - Database performance tuning
   - Security updates and patches
   - Backup verification

### Troubleshooting

1. **Display Issues**
   - Check video availability
   - Verify thumbnail URLs
   - Test different browsers/devices
   - Review CSS/styling conflicts

2. **Performance Problems**
   - Monitor database query times
   - Check cache hit rates
   - Review network loading times
   - Analyze JavaScript execution

3. **Admin Access Issues**
   - Verify authentication status
   - Check permission levels
   - Review API endpoint access
   - Test form submission workflows