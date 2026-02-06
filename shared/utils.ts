/**
 * Common utility functions used throughout the application
 */

import { z } from 'zod';
import { VALIDATION_CONSTANTS, ERROR_CODES } from './constants.js';

/**
 * Generate a slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Ensure slug is unique by appending a counter if necessary
 */
export function ensureUniqueSlug(
  slug: string,
  existingSlugs: string[]
): string {
  if (!existingSlugs.includes(slug)) {
    return slug;
  }

  let counter = 1;
  let uniqueSlug = `${slug}-${counter}`;
  
  while (existingSlugs.includes(uniqueSlug)) {
    counter++;
    uniqueSlug = `${slug}-${counter}`;
  }
  
  return uniqueSlug;
}

/**
 * Truncate text to a specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format duration from seconds to human-readable format
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Parse YouTube duration format (PT1H2M3S)
 */
export function parseYouTubeDuration(duration: string): number {
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const match = duration.match(regex);
  
  if (!match) {
    return 0;
  }
  
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
  const match = url.match(regex);
  
  return match ? match[1] : null;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize HTML content
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Create a throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as T;
  }
  
  const cloned = {} as T;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  
  return cloned;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Common Zod validation schemas
 */
export const commonSchemas = {
  id: z.string().uuid(),
  slug: z.string()
    .min(1, 'Slug is required')
    .max(VALIDATION_CONSTANTS.MAX_SLUG_LENGTH, `Slug must be less than ${VALIDATION_CONSTANTS.MAX_SLUG_LENGTH} characters`)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  
  title: z.string()
    .min(1, 'Title is required')
    .max(VALIDATION_CONSTANTS.MAX_TITLE_LENGTH, `Title must be less than ${VALIDATION_CONSTANTS.MAX_TITLE_LENGTH} characters`),
  
  description: z.string()
    .max(VALIDATION_CONSTANTS.MAX_DESCRIPTION_LENGTH, `Description must be less than ${VALIDATION_CONSTANTS.MAX_DESCRIPTION_LENGTH} characters`)
    .optional(),
  
  url: z.string()
    .url('Invalid URL format'),
  
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email must be less than 255 characters'),
  
  username: z.string()
    .min(VALIDATION_CONSTANTS.MIN_USERNAME_LENGTH, `Username must be at least ${VALIDATION_CONSTANTS.MIN_USERNAME_LENGTH} characters`)
    .max(VALIDATION_CONSTANTS.MAX_USERNAME_LENGTH, `Username must be less than ${VALIDATION_CONSTANTS.MAX_USERNAME_LENGTH} characters`)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username must contain only letters, numbers, underscores, and hyphens'),
  
  password: z.string()
    .min(VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH, `Password must be at least ${VALIDATION_CONSTANTS.MIN_PASSWORD_LENGTH} characters`)
    .max(VALIDATION_CONSTANTS.MAX_PASSWORD_LENGTH, `Password must be less than ${VALIDATION_CONSTANTS.MAX_PASSWORD_LENGTH} characters`),
  
  aspectRatio: z.enum(['16:9', '4:3', '1:1', '21:9']),
  
  animationType: z.enum(['fade', 'slide']),
  
  rotationInterval: z.number()
    .int('Rotation interval must be an integer')
    .min(1000, 'Rotation interval must be at least 1000ms')
    .max(10000, 'Rotation interval must be at most 10000ms'),
} as const;