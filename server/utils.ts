/**
 * Generate a URL-friendly slug from a string
 * Handles special characters, Serbian Latin/Cyrillic, and ensures uniqueness
 */
export function generateSlug(text: string, maxLength: number = 100): string {
  return (
    text
      .toLowerCase()
      .trim()
      // Replace Serbian special characters
      .replace(/č/g, "c")
      .replace(/ć/g, "c")
      .replace(/đ/g, "dj")
      .replace(/š/g, "s")
      .replace(/ž/g, "z")
      // Replace spaces and special characters with hyphens
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/--+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "")
      .substring(0, maxLength)
  );
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
