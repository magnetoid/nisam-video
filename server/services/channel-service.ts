import { ChannelRepository } from '../repositories/channel-repository.js';
import { VideoRepository } from '../repositories/video-repository.js';
import { NotFoundError, ValidationError, BusinessLogicError } from '../errors/custom-errors.js';
import { generateSlug, isValidUrl } from '../../shared/utils.js';
import { VALIDATION_CONSTANTS } from '../../shared/constants.js';
import type { Channel, InsertChannel } from '../../shared/schema.js';

/**
 * Service layer for Channel business logic
 * Handles complex operations that involve multiple repositories or business rules
 */
export class ChannelService {
  constructor(
    private channelRepository: ChannelRepository = new ChannelRepository(),
    private videoRepository: VideoRepository = new VideoRepository()
  ) {}

  /**
   * Create a new channel with validation and business logic
   */
  async createChannel(data: InsertChannel): Promise<Channel> {
    // Validate URL format
    if (!isValidUrl(data.url)) {
      throw new ValidationError('Invalid channel URL format', 'url');
    }

    // Validate name length
    if (data.name.length > VALIDATION_CONSTANTS.MAX_TITLE_LENGTH) {
      throw new ValidationError(
        `Channel name must be less than ${VALIDATION_CONSTANTS.MAX_TITLE_LENGTH} characters`,
        'name'
      );
    }

    // Check if channel already exists
    const existingChannel = await this.channelRepository.findByChannelId(data.channelId || '');
    if (existingChannel) {
      throw new BusinessLogicError('Channel with this ID already exists');
    }

    // Create channel
    return await this.channelRepository.create(data);
  }

  /**
   * Get channel with related statistics
   */
  async getChannelWithStats(channelId: string): Promise<{
    channel: Channel;
    videoCount: number;
    recentVideos: any[];
  }> {
    const channel = await this.channelRepository.findById(channelId);
    if (!channel) {
      throw new NotFoundError('Channel', channelId);
    }

    // Get video count and recent videos
    const [videoCount, recentVideos] = await Promise.all([
      this.videoRepository.count(),
      this.videoRepository.findByChannelId(channelId, 5)
    ]);

    return {
      channel,
      videoCount,
      recentVideos
    };
  }

  /**
   * Update channel with validation
   */
  async updateChannel(channelId: string, updates: Partial<InsertChannel>): Promise<Channel> {
    // Validate URL if provided
    if (updates.url && !isValidUrl(updates.url)) {
      throw new ValidationError('Invalid channel URL format', 'url');
    }

    // Validate name if provided
    if (updates.name && updates.name.length > VALIDATION_CONSTANTS.MAX_TITLE_LENGTH) {
      throw new ValidationError(
        `Channel name must be less than ${VALIDATION_CONSTANTS.MAX_TITLE_LENGTH} characters`,
        'name'
      );
    }

    // Check if channel exists
    const existingChannel = await this.channelRepository.findById(channelId);
    if (!existingChannel) {
      throw new NotFoundError('Channel', channelId);
    }

    // Update channel
    const updatedChannel = await this.channelRepository.update(channelId, updates);
    if (!updatedChannel) {
      throw new BusinessLogicError('Failed to update channel');
    }

    return updatedChannel;
  }

  /**
   * Delete channel with cascade handling
   */
  async deleteChannel(channelId: string): Promise<void> {
    // Check if channel exists
    const channel = await this.channelRepository.findById(channelId);
    if (!channel) {
      throw new NotFoundError('Channel', channelId);
    }

    // Check if channel has videos (business rule)
    const videoCount = await this.videoRepository.count();
    if (videoCount > 0) {
      throw new BusinessLogicError('Cannot delete channel with existing videos');
    }

    // Delete channel
    const deleted = await this.channelRepository.delete(channelId);
    if (!deleted) {
      throw new BusinessLogicError('Failed to delete channel');
    }
  }

  /**
   * Get channels that need scraping
   */
  async getChannelsNeedingScrape(maxAgeHours: number = 24): Promise<Channel[]> {
    if (maxAgeHours < 1 || maxAgeHours > 168) { // 1 hour to 1 week
      throw new ValidationError('Scrape age must be between 1 and 168 hours', 'maxAgeHours');
    }

    return await this.channelRepository.findChannelsNeedingScrape(maxAgeHours);
  }

  /**
   * Mark channel as scraped
   */
  async markChannelAsScraped(channelId: string): Promise<Channel> {
    const channel = await this.channelRepository.updateLastScraped(channelId);
    if (!channel) {
      throw new NotFoundError('Channel', channelId);
    }
    return channel;
  }

  /**
   * Search channels by name
   */
  async searchChannels(query: string): Promise<Channel[]> {
    if (query.length < 2) {
      throw new ValidationError('Search query must be at least 2 characters', 'query');
    }

    return await this.channelRepository.findByName(query);
  }

  /**
   * Get channel platform statistics
   */
  async getChannelPlatformStats(): Promise<{
    totalChannels: number;
    platformCounts: Record<string, number>;
    channelsNeedingScrape: number;
  }> {
    const [totalChannels, platformCounts, channelsNeedingScrape] = await Promise.all([
      this.channelRepository.count(),
      this.channelRepository.getCountByPlatform(),
      this.channelRepository.findChannelsNeedingScrape(24)
    ]);

    return {
      totalChannels,
      platformCounts,
      channelsNeedingScrape: channelsNeedingScrape.length
    };
  }

  /**
   * Validate channel data before creation/update
   */
  private validateChannelData(data: Partial<InsertChannel>): void {
    if (data.name && data.name.trim().length === 0) {
      throw new ValidationError('Channel name is required', 'name');
    }

    if (data.url && !isValidUrl(data.url)) {
      throw new ValidationError('Invalid channel URL format', 'url');
    }

    if (data.channelId && data.channelId.trim().length === 0) {
      throw new ValidationError('Channel ID is required', 'channelId');
    }

    if (data.platform && !['youtube', 'tiktok'].includes(data.platform)) {
      throw new ValidationError('Platform must be either youtube or tiktok', 'platform');
    }
  }
}