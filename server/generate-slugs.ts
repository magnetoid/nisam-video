import { db } from "./db.js";
import { videos } from "../shared/schema.js";
import { sql } from "drizzle-orm";
import { generateSlug } from "./utils.js";

async function generateSlugsForExistingVideos() {
  console.log("Fetching all videos without slugs...");

  // Get all videos
  const allVideos = await db.select().from(videos);

  console.log(`Found ${allVideos.length} videos`);

  const existingSlugs: string[] = [];
  let updated = 0;

  for (const video of allVideos) {
    if (!video.slug) {
      // Generate slug from title
      const baseSlug = generateSlug(video.title);

      // Ensure uniqueness
      let slug = baseSlug;
      let counter = 1;
      while (existingSlugs.includes(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      existingSlugs.push(slug);

      // Update video with slug
      await db
        .update(videos)
        .set({ slug })
        .where(sql`${videos.id} = ${video.id}`);

      updated++;

      if (updated % 50 === 0) {
        console.log(`Updated ${updated}/${allVideos.length} videos...`);
      }
    } else {
      existingSlugs.push(video.slug);
    }
  }

  console.log(`✅ Successfully generated slugs for ${updated} videos`);
  process.exit(0);
}

generateSlugsForExistingVideos().catch((error) => {
  console.error("Error generating slugs:", error);
  process.exit(1);
});
