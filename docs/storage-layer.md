# Storage Layer Documentation

## Overview

The storage layer provides a unified interface for data persistence operations in the application. It abstracts the underlying database implementation and provides consistent methods for creating, reading, updating, and deleting data across all entities.

## Architecture

The storage layer follows an interface-based design pattern with two implementations:

1. **DatabaseStorage**: Production implementation using PostgreSQL via Drizzle ORM
2. **MemStorage**: Development implementation using in-memory data structures

### Interface Design

The `IStorage` interface defines all available methods:

```typescript
export interface IStorage {
  // Channels methods
  // Videos methods
  // Categories methods
  // Tags methods
  // Playlists methods
  // Settings methods
  // Utility methods
}
```

## Core Concepts

### Caching Strategy

The storage layer implements a multi-tier caching system:

1. **Method-Level Caching**: Individual methods can cache results
2. **TTL-Based Expiration**: Configurable time-to-live for cached data
3. **Cache Invalidation**: Automatic clearing when related data changes
4. **Pattern-Based Invalidation**: Bulk cache clearing for related entities

### Error Handling

All storage methods implement consistent error handling:

- **Graceful Failures**: Methods return undefined/error objects rather than throwing
- **Logging**: Errors are logged for debugging purposes
- **Fallback Behavior**: Methods provide sensible defaults when data is missing
- **Transaction Safety**: Database operations use transactions where appropriate

### Data Consistency

The storage layer ensures data consistency through:

- **Foreign Key Relationships**: Database-level referential integrity
- **Cascade Operations**: Automatic cleanup of related data
- **Validation**: Input validation before database operations
- **Atomic Operations**: All-or-nothing database transactions

## DatabaseStorage Implementation

### Initialization

The DatabaseStorage class initializes with database connection pooling:

```typescript
export class DatabaseStorage implements IStorage {
  constructor() {
    // Database connection established via db module
  }
}
```

### Query Optimization

Database queries are optimized for performance:

1. **Selective Field Retrieval**: Only fetch required fields
2. **Batch Operations**: Process multiple records in single queries
3. **Index Usage**: Leverage database indexes for fast lookups
4. **Connection Pooling**: Reuse database connections efficiently

### Method Categories

#### Channel Management

Methods for managing YouTube/TikTok channels:

- `createChannel(channel: InsertChannel): Promise<Channel>`
- `getChannel(id: string): Promise<Channel | undefined>`
- `getAllChannels(): Promise<Channel[]>`
- `updateChannel(id: string, data: Partial<Channel>): Promise<Channel | undefined>`
- `deleteChannel(id: string): Promise<void>`
- `getChannelsByPlatform(platform: string): Promise<Channel[]>`

#### Video Management

Methods for managing video content:

- `createVideo(video: InsertVideo): Promise<Video>`
- `getVideo(id: string): Promise<Video | undefined>`
- `getVideoBySlug(slug: string): Promise<Video | undefined>`
- `getVideoWithRelations(id: string): Promise<VideoWithRelations | undefined>`
- `getAllVideos(filters?: VideoFilters): Promise<VideoWithRelations[]>`
- `updateVideo(id: string, data: Partial<Video>): Promise<Video | undefined>`
- `deleteVideo(id: string): Promise<void>`
- `getVideoByVideoId(videoId: string): Promise<Video | undefined>`

#### Optimized Queries

Performance-optimized methods for common operations:

- `getHeroVideo(): Promise<VideoWithRelations | null>`
- `getRecentVideos(limit: number): Promise<VideoWithRelations[]>`
- `getVideosByCategory(categoryId: string, limit: number): Promise<VideoWithRelations[]>`
- `getTrendingVideos(limit: number): Promise<VideoWithRelations[]>`
- `getShorts(filters?: ShortFilters): Promise<VideoWithRelations[]>`

#### Category Management

Methods for managing video categories with multi-language support:

- `createCategory(category: InsertCategory): Promise<Category>`
- `getCategory(id: string): Promise<Category | undefined>`
- `getCategoryBySlug(slug: string): Promise<Category | undefined>`
- `getAllCategories(): Promise<Category[]>`
- `updateCategory(id: string, data: Partial<Category>): Promise<Category | undefined>`
- `deleteCategory(id: string): Promise<void>`

#### Tag Management

Methods for managing video tags:

- `createTag(tag: InsertTag): Promise<Tag>`
- `getTagsByVideoId(videoId: string): Promise<Tag[]>`
- `deleteTagsByVideoId(videoId: string): Promise<void>`

#### Video-Category Relations

Methods for managing many-to-many relationships:

- `addVideoCategory(videoId: string, categoryId: string): Promise<void>`
- `removeVideoCategories(videoId: string): Promise<void>`

#### Playlist Management

Methods for managing user-created playlists:

- `createPlaylist(playlist: InsertPlaylist): Promise<Playlist>`
- `getPlaylist(id: string): Promise<Playlist | undefined>`
- `getPlaylistWithVideos(id: string): Promise<PlaylistWithVideos | undefined>`
- `getAllPlaylists(): Promise<Playlist[]>`
- `updatePlaylist(id: string, data: Partial<Playlist>): Promise<Playlist | undefined>`
- `deletePlaylist(id: string): Promise<void>`
- `addVideoToPlaylist(playlistId: string, videoId: string, position?: number): Promise<void>`
- `removeVideoFromPlaylist(playlistId: string, videoId: string): Promise<void>`
- `getPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]>`

#### SEO Settings

Methods for managing global SEO configuration:

- `getSeoSettings(): Promise<SeoSettings | undefined>`
- `updateSeoSettings(data: Partial<SeoSettings>): Promise<SeoSettings>`

#### Scrape Jobs

Methods for tracking content scraping operations:

- `createScrapeJob(job: InsertScrapeJob): Promise<ScrapeJob>`
- `getScrapeJob(id: string): Promise<ScrapeJob | undefined>`
- `getActiveScrapeJob(): Promise<ScrapeJob | undefined>`
- `updateScrapeJob(id: string, data: Partial<ScrapeJob>): Promise<ScrapeJob | undefined>`

#### Scheduler Settings

Methods for managing automated scraping configuration:

- `getSchedulerSettings(): Promise<SchedulerSettings | undefined>`
- `updateSchedulerSettings(data: Partial<SchedulerSettings>): Promise<SchedulerSettings>`

#### System Settings

Methods for managing general application configuration:

- `getSystemSettings(): Promise<SystemSettings | undefined>`
- `updateSystemSettings(data: Partial<SystemSettings>): Promise<SystemSettings>`

#### Tag Images

Methods for managing tag image associations:

- `getTagImage(tagName: string): Promise<TagImage | undefined>`
- `updateTagImage(data: InsertTagImage): Promise<TagImage>`
- `deleteTagImage(tagName: string): Promise<void>`

#### Utilities

Additional utility methods:

- `updateAllVideoThumbnails(): Promise<number>`
- `incrementVideoViews(videoId: string, count: number): Promise<void>`

## MemStorage Implementation

The MemStorage class provides an in-memory implementation for development:

### Features

1. **Development Speed**: No database dependencies required
2. **Fast Operations**: In-memory data access
3. **Sample Data**: Pre-populated with demo content
4. **Consistent Interface**: Same methods as DatabaseStorage

### Limitations

1. **Data Persistence**: Data lost when application restarts
2. **Memory Usage**: Large datasets consume significant memory
3. **No Relationships**: Simplified data model without complex relationships
4. **Limited Querying**: Basic filtering only

## Method Documentation

### Channel Methods

#### createChannel

Creates a new channel entry:

```typescript
async createChannel(channel: InsertChannel): Promise<Channel>
```

**Parameters**:
- `channel`: Channel data to insert

**Returns**: Created channel object with generated ID

**Usage**:
```typescript
const newChannel = await storage.createChannel({
  name: "Demo Channel",
  url: "https://youtube.com/demo",
  platform: "youtube"
});
```

#### getChannel

Retrieves a channel by ID:

```typescript
async getChannel(id: string): Promise<Channel | undefined>
```

**Parameters**:
- `id`: Channel ID to retrieve

**Returns**: Channel object or undefined if not found

#### getAllChannels

Retrieves all channels with caching:

```typescript
async getAllChannels(): Promise<Channel[]>
```

**Returns**: Array of all channel objects

**Caching**: Cached for 10 minutes by default

#### updateChannel

Updates an existing channel:

```typescript
async updateChannel(
  id: string,
  data: Partial<Channel>
): Promise<Channel | undefined>
```

**Parameters**:
- `id`: Channel ID to update
- `data`: Partial channel data to update

**Returns**: Updated channel object or undefined if not found

#### deleteChannel

Deletes a channel and related data:

```typescript
async deleteChannel(id: string): Promise<void>
```

**Parameters**:
- `id`: Channel ID to delete

**Side Effects**: 
- Invalidates channels cache
- Removes all videos associated with channel (in database implementation)

#### getChannelsByPlatform

Retrieves channels filtered by platform:

```typescript
async getChannelsByPlatform(platform: string): Promise<Channel[]>
```

**Parameters**:
- `platform`: Platform to filter by ("youtube" or "tiktok")

**Returns**: Array of channels for specified platform

### Video Methods

#### createVideo

Creates a new video entry:

```typescript
async createVideo(video: InsertVideo): Promise<Video>
```

**Parameters**:
- `video`: Video data to insert

**Returns**: Created video object with generated ID

#### getVideo

Retrieves a video by ID:

```typescript
async getVideo(id: string): Promise<Video | undefined>
```

**Parameters**:
- `id`: Video ID to retrieve

**Returns**: Video object or undefined if not found

#### getVideoBySlug

Retrieves a video by slug:

```typescript
async getVideoBySlug(slug: string): Promise<Video | undefined>
```

**Parameters**:
- `slug`: Video slug to retrieve

**Returns**: Video object or undefined if not found

#### getVideoWithRelations

Retrieves a video with associated channel, tags, and categories:

```typescript
async getVideoWithRelations(id: string): Promise<VideoWithRelations | undefined>
```

**Parameters**:
- `id`: Video ID to retrieve

**Returns**: Video object with related data or undefined if not found

#### getAllVideos

Retrieves all videos with optional filtering:

```typescript
async getAllVideos(filters?: {
  channelId?: string;
  categoryId?: string;
  search?: string;
}): Promise<VideoWithRelations[]>
```

**Parameters**:
- `filters`: Optional filtering criteria

**Returns**: Array of videos with related data

#### updateVideo

Updates an existing video:

```typescript
async updateVideo(
  id: string,
  data: Partial<Video>
): Promise<Video | undefined>
```

**Parameters**:
- `id`: Video ID to update
- `data`: Partial video data to update

**Returns**: Updated video object or undefined if not found

#### deleteVideo

Deletes a video and related data:

```typescript
async deleteVideo(id: string): Promise<void>
```

**Parameters**:
- `id`: Video ID to delete

**Side Effects**:
- Removes associated tags
- Removes category associations
- Removes from playlists
- Invalidates video cache

#### getVideoByVideoId

Retrieves a video by external video ID:

```typescript
async getVideoByVideoId(videoId: string): Promise<Video | undefined>
```

**Parameters**:
- `videoId`: External video ID (YouTube/TikTok ID)

**Returns**: Video object or undefined if not found

### Optimized Query Methods

#### getHeroVideo

Retrieves the most recent video for hero display:

```typescript
async getHeroVideo(): Promise<VideoWithRelations | null>
```

**Returns**: Most recent video or null if none exist

**Caching**: Cached for 5 minutes

#### getRecentVideos

Retrieves recently published videos:

```typescript
async getRecentVideos(limit: number): Promise<VideoWithRelations[]>
```

**Parameters**:
- `limit`: Maximum number of videos to return

**Returns**: Array of recent videos

#### getVideosByCategory

Retrieves videos for a specific category:

```typescript
async getVideosByCategory(
  categoryId: string,
  limit: number
): Promise<VideoWithRelations[]>
```

**Parameters**:
- `categoryId`: Category ID to filter by
- `limit`: Maximum number of videos to return

**Returns**: Array of videos in specified category

#### getTrendingVideos

Retrieves trending videos based on popularity metrics:

```typescript
async getTrendingVideos(limit: number): Promise<VideoWithRelations[]>
```

**Parameters**:
- `limit`: Maximum number of videos to return

**Returns**: Array of trending videos

#### getShorts

Retrieves short-form videos (YouTube Shorts/TikTok):

```typescript
async getShorts(filters?: {
  type?: "youtube_short" | "tiktok";
  limit?: number;
  offset?: number;
}): Promise<VideoWithRelations[]>
```

**Parameters**:
- `filters`: Optional filtering criteria

**Returns**: Array of short-form videos

### Category Methods

#### createCategory

Creates a new category:

```typescript
async createCategory(category: InsertCategory): Promise<Category>
```

**Parameters**:
- `category`: Category data to insert

**Returns**: Created category object with generated ID

#### getCategory

Retrieves a category by ID:

```typescript
async getCategory(id: string): Promise<Category | undefined>
```

**Parameters**:
- `id`: Category ID to retrieve

**Returns**: Category object or undefined if not found

#### getCategoryBySlug

Retrieves a category by slug:

```typescript
async getCategoryBySlug(slug: string): Promise<Category | undefined>
```

**Parameters**:
- `slug`: Category slug to retrieve

**Returns**: Category object or undefined if not found

#### getAllCategories

Retrieves all categories with caching:

```typescript
async getAllCategories(): Promise<Category[]>
```

**Returns**: Array of all category objects

**Caching**: Cached for 10 minutes by default

#### updateCategory

Updates an existing category:

```typescript
async updateCategory(
  id: string,
  data: Partial<Category>
): Promise<Category | undefined>
```

**Parameters**:
- `id`: Category ID to update
- `data`: Partial category data to update

**Returns**: Updated category object or undefined if not found

#### deleteCategory

Deletes a category and related data:

```typescript
async deleteCategory(id: string): Promise<void>
```

**Parameters**:
- `id`: Category ID to delete

**Side Effects**:
- Removes category from all videos
- Invalidates categories cache

### Tag Methods

#### createTag

Creates a new tag:

```typescript
async createTag(tag: InsertTag): Promise<Tag>
```

**Parameters**:
- `tag`: Tag data to insert

**Returns**: Created tag object with generated ID

#### getTagsByVideoId

Retrieves tags for a specific video:

```typescript
async getTagsByVideoId(videoId: string): Promise<Tag[]>
```

**Parameters**:
- `videoId`: Video ID to retrieve tags for

**Returns**: Array of tags for specified video

#### deleteTagsByVideoId

Deletes all tags for a specific video:

```typescript
async deleteTagsByVideoId(videoId: string): Promise<void>
```

**Parameters**:
- `videoId`: Video ID to delete tags for

### Video-Category Relation Methods

#### addVideoCategory

Associates a video with a category:

```typescript
async addVideoCategory(
  videoId: string,
  categoryId: string
): Promise<void>
```

**Parameters**:
- `videoId`: Video ID to associate
- `categoryId`: Category ID to associate

#### removeVideoCategories

Removes all category associations for a video:

```typescript
async removeVideoCategories(videoId: string): Promise<void>
```

**Parameters**:
- `videoId`: Video ID to remove associations for

### Playlist Methods

#### createPlaylist

Creates a new playlist:

```typescript
async createPlaylist(playlist: InsertPlaylist): Promise<Playlist>
```

**Parameters**:
- `playlist`: Playlist data to insert

**Returns**: Created playlist object with generated ID

#### getPlaylist

Retrieves a playlist by ID:

```typescript
async getPlaylist(id: string): Promise<Playlist | undefined>
```

**Parameters**:
- `id`: Playlist ID to retrieve

**Returns**: Playlist object or undefined if not found

#### getPlaylistWithVideos

Retrieves a playlist with associated videos:

```typescript
async getPlaylistWithVideos(
  id: string
): Promise<PlaylistWithVideos | undefined>
```

**Parameters**:
- `id`: Playlist ID to retrieve

**Returns**: Playlist object with videos or undefined if not found

#### getAllPlaylists

Retrieves all playlists:

```typescript
async getAllPlaylists(): Promise<Playlist[]>
```

**Returns**: Array of all playlist objects

#### updatePlaylist

Updates an existing playlist:

```typescript
async updatePlaylist(
  id: string,
  data: Partial<Playlist>
): Promise<Playlist | undefined>
```

**Parameters**:
- `id`: Playlist ID to update
- `data`: Partial playlist data to update

**Returns**: Updated playlist object or undefined if not found

#### deletePlaylist

Deletes a playlist:

```typescript
async deletePlaylist(id: string): Promise<void>
```

**Parameters**:
- `id`: Playlist ID to delete

#### addVideoToPlaylist

Adds a video to a playlist:

```typescript
async addVideoToPlaylist(
  playlistId: string,
  videoId: string,
  position?: number
): Promise<void>
```

**Parameters**:
- `playlistId`: Playlist ID to add video to
- `videoId`: Video ID to add
- `position`: Optional position in playlist

#### removeVideoFromPlaylist

Removes a video from a playlist:

```typescript
async removeVideoFromPlaylist(
  playlistId: string,
  videoId: string
): Promise<void>
```

**Parameters**:
- `playlistId`: Playlist ID to remove video from
- `videoId`: Video ID to remove

#### getPlaylistVideos

Retrieves videos in a playlist:

```typescript
async getPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]>
```

**Parameters**:
- `playlistId`: Playlist ID to retrieve videos for

**Returns**: Array of playlist-video associations

### SEO Settings Methods

#### getSeoSettings

Retrieves global SEO settings:

```typescript
async getSeoSettings(): Promise<SeoSettings | undefined>
```

**Returns**: SEO settings object or undefined if not configured

**Caching**: Cached for 10 minutes

#### updateSeoSettings

Updates global SEO settings:

```typescript
async updateSeoSettings(
  data: Partial<SeoSettings>
): Promise<SeoSettings>
```

**Parameters**:
- `data`: Partial SEO settings to update

**Returns**: Updated SEO settings object

### Scrape Job Methods

#### createScrapeJob

Creates a new scrape job record:

```typescript
async createScrapeJob(job: InsertScrapeJob): Promise<ScrapeJob>
```

**Parameters**:
- `job`: Scrape job data to insert

**Returns**: Created scrape job object with generated ID

#### getScrapeJob

Retrieves a scrape job by ID:

```typescript
async getScrapeJob(id: string): Promise<ScrapeJob | undefined>
```

**Parameters**:
- `id`: Scrape job ID to retrieve

**Returns**: Scrape job object or undefined if not found

#### getActiveScrapeJob

Retrieves the currently running scrape job:

```typescript
async getActiveScrapeJob(): Promise<ScrapeJob | undefined>
```

**Returns**: Active scrape job object or undefined if none running

#### updateScrapeJob

Updates an existing scrape job:

```typescript
async updateScrapeJob(
  id: string,
  data: Partial<ScrapeJob>
): Promise<ScrapeJob | undefined>
```

**Parameters**:
- `id`: Scrape job ID to update
- `data`: Partial scrape job data to update

**Returns**: Updated scrape job object or undefined if not found

### Scheduler Settings Methods

#### getSchedulerSettings

Retrieves scheduler configuration:

```typescript
async getSchedulerSettings(): Promise<SchedulerSettings | undefined>
```

**Returns**: Scheduler settings object or undefined if not configured

#### updateSchedulerSettings

Updates scheduler configuration:

```typescript
async updateSchedulerSettings(
  data: Partial<SchedulerSettings>
): Promise<SchedulerSettings>
```

**Parameters**:
- `data`: Partial scheduler settings to update

**Returns**: Updated scheduler settings object

### System Settings Methods

#### getSystemSettings

Retrieves global system settings:

```typescript
async getSystemSettings(): Promise<SystemSettings | undefined>
```

**Returns**: System settings object or undefined if not configured

#### updateSystemSettings

Updates global system settings:

```typescript
async updateSystemSettings(
  data: Partial<SystemSettings>
): Promise<SystemSettings>
```

**Parameters**:
- `data`: Partial system settings to update

**Returns**: Updated system settings object

### Tag Image Methods

#### getTagImage

Retrieves image URL for a tag:

```typescript
async getTagImage(tagName: string): Promise<TagImage | undefined>
```

**Parameters**:
- `tagName`: Tag name to retrieve image for

**Returns**: Tag image object or undefined if not configured

#### updateTagImage

Updates or creates tag image association:

```typescript
async updateTagImage(data: InsertTagImage): Promise<TagImage>
```

**Parameters**:
- `data`: Tag image data to insert/update

**Returns**: Updated tag image object

#### deleteTagImage

Deletes tag image association:

```typescript
async deleteTagImage(tagName: string): Promise<void>
```

**Parameters**:
- `tagName`: Tag name to delete image for

### Utility Methods

#### updateAllVideoThumbnails

Updates thumbnail URLs for all videos:

```typescript
async updateAllVideoThumbnails(): Promise<number>
```

**Returns**: Number of videos updated

#### incrementVideoViews

Increments view count for a video:

```typescript
async incrementVideoViews(
  videoId: string,
  count: number
): Promise<void>
```

**Parameters**:
- `videoId`: Video ID to increment views for
- `count`: Number of views to add

## Best Practices

### Performance Optimization

1. **Use Caching**: Leverage built-in caching for frequently accessed data
2. **Batch Operations**: Use bulk methods when processing multiple records
3. **Selective Queries**: Only fetch required fields and related data
4. **Connection Management**: Reuse database connections efficiently

### Data Integrity

1. **Validation**: Validate input data before database operations
2. **Transactions**: Use transactions for multi-step operations
3. **Constraints**: Rely on database constraints for data integrity
4. **Cascade Operations**: Configure appropriate cascade behaviors

### Error Handling

1. **Graceful Failures**: Handle missing data gracefully
2. **Logging**: Log errors for debugging and monitoring
3. **Fallback Values**: Provide sensible defaults when data is missing
4. **User Feedback**: Communicate errors clearly to users

### Security

1. **Input Sanitization**: Sanitize all user-provided data
2. **Authentication**: Ensure proper authorization for sensitive operations
3. **SQL Injection**: Use parameterized queries to prevent injection attacks
4. **Data Exposure**: Limit sensitive data in responses

## Testing

### Unit Testing

Each storage method should have unit tests covering:

1. **Happy Path**: Normal operation with valid data
2. **Edge Cases**: Boundary conditions and special scenarios
3. **Error Conditions**: Handling of invalid inputs and failures
4. **Performance**: Response time and resource usage

### Integration Testing

Integration tests should verify:

1. **Database Connectivity**: Successful connection to database
2. **Query Execution**: Correct execution of database queries
3. **Data Consistency**: Proper handling of related data
4. **Caching Behavior**: Correct cache behavior and invalidation

## Maintenance

### Regular Tasks

1. **Cache Monitoring**: Monitor cache hit rates and performance
2. **Database Maintenance**: Perform regular database maintenance tasks
3. **Performance Tuning**: Optimize slow queries and operations
4. **Backup Verification**: Ensure data backup procedures are working

### Troubleshooting

1. **Connection Issues**: Check database connectivity and credentials
2. **Performance Problems**: Analyze slow queries and optimize
3. **Data Corruption**: Verify data integrity and implement recovery procedures
4. **Cache Issues**: Investigate cache misses and invalidation problems

## Future Enhancements

### Planned Improvements

1. **Advanced Caching**: Implement more sophisticated caching strategies
2. **Query Optimization**: Further optimize database queries for performance
3. **Monitoring**: Add detailed performance and error monitoring
4. **Migration Tools**: Develop tools for schema migrations and data upgrades