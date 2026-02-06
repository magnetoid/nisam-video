import { eq, desc, sql, like } from 'drizzle-orm';
import { videos } from '../../shared/schema.js';
import { BaseRepository } from './base-repository.js';
import { db } from '../db.js';
import { DatabaseError } from '../errors/custom-errors.js';
import type { Video, InsertVideo, VideoWithRelations } from '../../shared/schema.js';

/**
 * Repository for Video entities
 * Handles all database operations related to videos
 */
export class VideoRepository extends BaseRepository<Video, InsertVideo> {
  protected table = videos;
  protected entityName = 'Video';

  /**
   * Find videos by channel ID
   */
  async findByChannelId(channelId: string, limit?: number): Promise<Video[]> {
    try {
      let query = db.select().from(videos)
        .where(eq(videos.channelId, channelId))
        .orderBy(desc(videos.createdAt));
      
      if (limit) {
        query = query.limit(limit);
      }
      
      return await query;
    } catch (error) {
      throw new DatabaseError(`Failed to find videos by channel ID ${channelId}`, { 
        channelId,
        limit,
        cause: error 
      });
    }
  }

  /**
   * Find videos by video type (regular, youtube_short, tiktok)
   */
  async findByVideoType(videoType: 'regular' | 'youtube_short' | 'tiktok'): Promise<Video[]> {
    try {
      return await db.select().from(videos)
        .where(eq(videos.videoType, videoType))
        .orderBy(desc(videos.createdAt));
    } catch (error) {
      throw new DatabaseError(`Failed to find videos by type ${videoType}`, { 
        videoType,
        cause: error 
      });
    }
  }

  /**
   * Search videos by title
   */
  async searchByTitle(query: string, limit: number = 20): Promise<Video[]> {
    try {
      return await db.select().from(videos)
        .where(like(videos.title, `%${query}%`))
        .orderBy(desc(videos.createdAt))
        .limit(limit);
    } catch (error) {
      throw new DatabaseError(`Failed to search videos by title: ${query}`, { 
        query,
        limit,
        cause: error 
      });
    }
  }

  /**
   * Find videos with relations (channel, categories, tags)
   */
  async findWithRelations(id: string): Promise<VideoWithRelations | null> {
    try {
      // This would require joining with other tables
      // For now, return basic video
      return await this.findById(id) as VideoWithRelations;
    } catch (error) {
      throw new DatabaseError(`Failed to find video with relations ${id}`, { 
        id,
        cause: error 
      });
    }
  }

  /**
   * Find recent videos
   */
  async findRecent(limit: number = 10): Promise<Video[]> {
    try {
      return await db.select().from(videos)
        .orderBy(desc(videos.createdAt))
        .limit(limit);
    } catch (error) {
      throw new DatabaseError('Failed to find recent videos', { 
        limit,
        cause: error 
      });
    }
  }

  /**
   * Find popular videos by internal views
   */
  async findPopular(limit: number = 10): Promise<Video[]> {
    try {
      return await db.select().from(videos)
        .orderBy(desc(videos.internalViewsCount))
        .limit(limit);
    } catch (error) {
      throw new DatabaseError('Failed to find popular videos', { 
        limit,
        cause: error 
      });
    }
  }

  /**
   * Increment video view count
   */
  async incrementViewCount(videoId: string): Promise<Video | null> {
    try {
      const [updated] = await db.update(videos)
        .set({ 
          internalViewsCount: sql`${videos.internalViewsCount} + 1` 
        })
        .where(eq(videos.id, videoId))
        .returning();
      
      return updated || null;
    } catch (error) {
      throw new DatabaseError(`Failed to increment view count for video ${videoId}`, { 
        videoId,
        cause: error 
      });
    }
  }

  /**
   * Increment video like count
   */
  async incrementLikeCount(videoId: string): Promise<Video | null> {
    try {
      const [updated] = await db.update(videos)
        .set({ 
          likesCount: sql`${videos.likesCount} + 1` 
        })
        .where(eq(videos.id, videoId))
        .returning();
      
      return updated || null;
    } catch (error) {
      throw new DatabaseError(`Failed to increment like count for video ${videoId}`, { 
        videoId,
        cause: error 
      });
    }
  }

  /**
   * Decrement video like count
   */
  async decrementLikeCount(videoId: string): Promise<Video | null> {
    try {
      const [updated] = await db.update(videos)
        .set({ 
          likesCount: sql`CASE WHEN ${videos.likesCount} > 0 THEN ${videos.likesCount} - 1 ELSE 0 END` 
        })
        .where(eq(videos.id, videoId))
        .returning();
      
      return updated || null;
    } catch (error) {
      throw new DatabaseError(`Failed to decrement like count for video ${videoId}`, { 
        videoId,
        cause: error 
      });
    }
  }

  /**
   * Update video slug
   */
  async updateSlug(videoId: string, slug: string): Promise<Video | null> {
    try {
      const [updated] = await db.update(videos)
        .set({ slug })
        .where(eq(videos.id, videoId))
        .returning();
      
      return updated || null;
    } catch (error) {
      throw new DatabaseError(`Failed to update slug for video ${videoId}`, { 
        videoId,
        slug,
        cause: error 
      });
    }
  }

  /**
   * Find videos by slug
   */
  async findBySlug(slug: string): Promise<Video | null> {
    try {
      const result = await db.select().from(videos)
        .where(eq(videos.slug, slug));
      
      return result[0] || null;
    } catch (error) {
      throw new DatabaseError(`Failed to find video by slug ${slug}`, { 
        slug,
        cause: error 
      });
    }
  }

  /**
   * Get video statistics
   */
  async getStatistics(): Promise<{
    totalVideos: number;
    totalViews: number;
    totalLikes: number;
    videoTypeCounts: Record<string, number>;
  }> {
    try {
      const [totalResult, viewsResult, likesResult, typeResults] = await Promise.all([
        db.select({ count: sql`COUNT(*)::int` }).from(videos),
        db.select({ totalViews: sql`SUM(${videos.internalViewsCount})::int` }).from(videos),
        db.select({ totalLikes: sql`SUM(${videos.likesCount})::int` }).from(videos),
        db.select({
          videoType: videos.videoType,
          count: sql`COUNT(*)::int`
        })
        .from(videos)
        .groupBy(videos.videoType)
      ]);

      const videoTypeCounts = typeResults.reduce((acc: Record<string, number>, row: any) => {
        acc[row.videoType] = row.count;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalVideos: totalResult[0]?.count || 0,
        totalViews: viewsResult[0]?.totalViews || 0,
        totalLikes: likesResult[0]?.totalLikes || 0,
        videoTypeCounts
      };
    } catch (error) {
      throw new DatabaseError('Failed to get video statistics', { 
        cause: error 
      });
    }
  }
}
