import { Request } from "express";
import slugify from "slugify";

/**
 * Get a unique identifier for the user (user ID or IP address)
 */
export function getUserIdentifier(req: Request): string {
  const user = (req as any).user;
  if (user) {
    return `user:${user.id}`;
  }
  return `ip:${req.ip}`;
}

/**
 * Generate a URL-friendly slug from a string
 * Handles special characters, Serbian Latin/Cyrillic, and ensures uniqueness
 */
export function generateSlug(text: string, maxLength: number = 100): string {
  // Custom mapping for specific Balkan/Cyrillic characters not fully covered by default slugify
  slugify.extend({
    'đ': 'dj',
    'Đ': 'dj',
    'č': 'c',
    'Č': 'c',
    'ć': 'c',
    'Ć': 'c',
    'š': 's',
    'Š': 's',
    'ž': 'z',
    'Ž': 'z'
  });

  const slug = slugify(text, {
    replacement: '-',  // replace spaces with replacement character
    remove: /[*+~.()'"!:@]/g, // remove characters that match regex
    lower: true,      // convert to lower case
    strict: true,     // strip special characters except replacement
    locale: 'hr',      // language code of the locale to use
    trim: true         // trim leading and trailing replacement chars
  });

  return slug.substring(0, maxLength);
}

/**
 * Ensure slug uniqueness by appending a counter if needed
 */
export function ensureUniqueSlug(
  baseSlug: string,
  existingSlugs: string[],
): string {
  let slug = baseSlug;
  let counter = 1;

  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
