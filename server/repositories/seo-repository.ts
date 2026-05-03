import { db } from "../db.js";
import { eq, sql } from "drizzle-orm";
import {
  seoSettings,
  seoMetaTags,
  seoRedirects,
  seoKeywords,
  seoAuditLogs,
  seoABTests,
  seoCompetitors,
  type SeoSettings,
  type InsertSeoSettings,
} from "../../shared/schema.js";

// Manually extract types from the schema using InferSelectModel/InferInsertModel if they aren't exported directly
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";
export type SeoMetaTag = InferSelectModel<typeof seoMetaTags>;
export type InsertSeoMetaTag = InferInsertModel<typeof seoMetaTags>;
export type SeoRedirect = InferSelectModel<typeof seoRedirects>;
export type InsertSeoRedirect = InferInsertModel<typeof seoRedirects>;

export class SeoRepository {
  async getSettings(): Promise<SeoSettings | undefined> {
    try {
      const [settings] = await db.select().from(seoSettings).limit(1);
      return settings || undefined;
    } catch (error) {
      console.error("[SeoRepository] getSettings failed:", error);
      return undefined;
    }
  }

  async updateSettings(data: Partial<InsertSeoSettings>): Promise<SeoSettings> {
    try {
      const current = await this.getSettings();
      if (!current) {
        const [settings] = await db.insert(seoSettings).values(data as InsertSeoSettings).returning();
        return settings;
      }
      const [updated] = await db
        .update(seoSettings)
        .set({ ...data, updatedAt: sql`now()` })
        .where(eq(seoSettings.id, current.id))
        .returning();
      return updated;
    } catch (error) {
      console.error("[SeoRepository] updateSettings failed:", error);
      throw error;
    }
  }

  async getMetaTags(pageUrl: string): Promise<SeoMetaTag | undefined> {
    try {
      const [tags] = await db
        .select()
        .from(seoMetaTags)
        .where(eq(seoMetaTags.pageUrl, pageUrl))
        .limit(1);
      return tags || undefined;
    } catch (error) {
      console.error(`[SeoRepository] getMetaTags failed for url ${pageUrl}:`, error);
      return undefined;
    }
  }

  async upsertMetaTags(data: InsertSeoMetaTag): Promise<SeoMetaTag> {
    try {
      const existing = await this.getMetaTags(data.pageUrl);
      if (existing) {
        const [updated] = await db
          .update(seoMetaTags)
          .set({ ...data, updatedAt: sql`now()` })
          .where(eq(seoMetaTags.id, existing.id))
          .returning();
        return updated;
      }
      const [created] = await db.insert(seoMetaTags).values(data).returning();
      return created;
    } catch (error) {
      console.error(`[SeoRepository] upsertMetaTags failed:`, error);
      throw error;
    }
  }

  async getRedirects(): Promise<SeoRedirect[]> {
    try {
      return await db.select().from(seoRedirects).orderBy(seoRedirects.fromUrl);
    } catch (error) {
      console.error("[SeoRepository] getRedirects failed:", error);
      return [];
    }
  }

  async addRedirect(data: InsertSeoRedirect): Promise<SeoRedirect> {
    try {
      const [created] = await db.insert(seoRedirects).values(data).returning();
      return created;
    } catch (error) {
      console.error("[SeoRepository] addRedirect failed:", error);
      throw error;
    }
  }

  async deleteRedirect(id: string): Promise<void> {
    try {
      await db.delete(seoRedirects).where(eq(seoRedirects.id, id));
    } catch (error) {
      console.error(`[SeoRepository] deleteRedirect failed for id ${id}:`, error);
      throw error;
    }
  }
}

export const seoRepository = new SeoRepository();
