import { eq, desc, sql } from 'drizzle-orm';
import { channels } from '../../shared/schema.js';
import { BaseRepository } from './base-repository.js';
import { db } from '../db.js';
import { DatabaseError } from '../errors/custom-errors.js';
import type { Channel, InsertChannel } from '../../shared/schema.js';

/**
 * Repository for Channel entities
 * Handles all database operations related to channels
 */
export class ChannelRepository extends BaseRepository<Channel, InsertChannel> {
  protected table = channels;
  protected entityName = 'Channel';

  /**
   * Find channels by platform
   */
  async findByPlatform(platform: 'youtube' | 'tiktok'): Promise<Channel[]> {
    try {
      return await db.select().from(channels)
        .where(eq(channels.platform, platform))
        .orderBy(desc(channels.createdAt));
    } catch (error) {
      throw new DatabaseError(`Failed to find channels by platform ${platform}`, { 
        platform,
        cause: error 
      });
    }
  }

  /**
   * Find channels that need scraping
   */
  async findChannelsNeedingScrape(maxAgeHours: number = 24): Promise<Channel[]> {
    try {
      const cutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      
      return await db.select().from(channels)
        .where(sql`${channels.lastScraped} IS NULL OR ${channels.lastScraped} < ${cutoffDate}`)
        .orderBy(desc(channels.lastScraped));
    } catch (error) {
      throw new DatabaseError('Failed to find channels needing scrape', { 
        maxAgeHours,
        cause: error 
      });
    }
  }

  /**
   * Update channel's last scraped timestamp
   */
  async updateLastScraped(channelId: string): Promise<Channel | null> {
    try {
      const [updated] = await db.update(channels)
        .set({ lastScraped: new Date() })
        .where(eq(channels.id, channelId))
        .returning();
      
      return updated || null;
    } catch (error) {
      throw new DatabaseError(`Failed to update last scraped for channel ${channelId}`, { 
        channelId,
        cause: error 
      });
    }
  }

  /**
   * Increment channel video count
   */
  async incrementVideoCount(channelId: string): Promise<Channel | null> {
    try {
      const [updated] = await db.update(channels)
        .set({ 
          videoCount: sql`${channels.videoCount} + 1` 
        })
        .where(eq(channels.id, channelId))
        .returning();
      
      return updated || null;
    } catch (error) {
      throw new DatabaseError(`Failed to increment video count for channel ${channelId}`, { 
        channelId,
        cause: error 
      });
    }
  }

  /**
   * Decrement channel video count
   */
  async decrementVideoCount(channelId: string): Promise<Channel | null> {
    try {
      const [updated] = await db.update(channels)
        .set({ 
          videoCount: sql`CASE WHEN ${channels.videoCount} > 0 THEN ${channels.videoCount} - 1 ELSE 0 END` 
        })
        .where(eq(channels.id, channelId))
        .returning();
      
      return updated || null;
    } catch (error) {
      throw new DatabaseError(`Failed to decrement video count for channel ${channelId}`, { 
        channelId,
        cause: error 
      });
    }
  }

  /**
   * Find channel by channel ID (YouTube/TikTok ID)
   */
  async findByChannelId(channelId: string): Promise<Channel | null> {
    try {
      const result = await db.select().from(channels)
        .where(eq(channels.channelId, channelId));
      
      return result[0] || null;
    } catch (error) {
      throw new DatabaseError(`Failed to find channel by channel ID ${channelId}`, { 
        channelId,
        cause: error 
      });
    }
  }

  /**
   * Find channels by name (case-insensitive search)
   */
  async findByName(name: string): Promise<Channel[]> {
    try {
      return await db.select().from(channels)
        .where(sql`LOWER(${channels.name}) LIKE LOWER(${`%${name}%`})`)
        .orderBy(desc(channels.createdAt));
    } catch (error) {
      throw new DatabaseError(`Failed to find channels by name ${name}`, { 
        name,
        cause: error 
      });
    }
  }

  /**
   * Get total channel count by platform
   */
  async getCountByPlatform(): Promise<Record<string, number>> {
    try {
      const results = await db.select({
        platform: channels.platform,
        count: sql`COUNT(*)::int`
      })
      .from(channels)
      .groupBy(channels.platform);
      
      return results.reduce((acc: Record<string, number>, row: any) => {
        acc[row.platform] = row.count;
        return acc;
      }, {} as Record<string, number>);
    } catch (error) {
      throw new DatabaseError('Failed to get channel count by platform', { 
        cause: error 
      });
    }
  }
}
