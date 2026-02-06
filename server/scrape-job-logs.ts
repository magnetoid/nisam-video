import { sql } from "drizzle-orm";
import { db } from "./db.js";

export type ScrapeJobLogLevel = "info" | "warn" | "error" | "debug";

export type ScrapeJobLogEntry = {
  time: string;
  level: ScrapeJobLogLevel;
  message: string;
  channelId?: string;
  channelName?: string;
  data?: Record<string, unknown>;
};

export async function appendScrapeJobLog(jobId: string, entry: Omit<ScrapeJobLogEntry, "time">) {
  const logEntry: ScrapeJobLogEntry = {
    time: new Date().toISOString(),
    ...entry,
  };

  await db.execute(sql`
    UPDATE scrape_jobs
    SET logs = logs || ${JSON.stringify([logEntry])}::jsonb
    WHERE id = ${jobId}
  `);
}

