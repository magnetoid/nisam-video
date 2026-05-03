import * as cheerio from "cheerio";
import { recordError } from "./error-log-service.js";
import pRetry from "p-retry";
import pLimit from "p-limit";

export interface ScraperOptions {
  maxRetries?: number;
  concurrency?: number;
  timeoutMs?: number;
}

export abstract class BaseScraper<T> {
  protected options: Required<ScraperOptions>;
  protected limit: ReturnType<typeof pLimit>;

  constructor(options: ScraperOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      concurrency: options.concurrency ?? 2,
      timeoutMs: options.timeoutMs ?? 20000,
    };
    this.limit = pLimit(this.options.concurrency);
  }

  protected async fetchWithRetry(url: string, fetchOptions: RequestInit = {}): Promise<Response> {
    return pRetry(
      async () => {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: AbortSignal.timeout(this.options.timeoutMs),
        });

        if (!response.ok) {
          if (response.status === 404) {
            // Do not retry 404s
            throw new pRetry.AbortError(`Resource not found: 404 ${url}`);
          }
          throw new Error(`HTTP error! status: ${response.status} for ${url}`);
        }

        return response;
      },
      {
        retries: this.options.maxRetries,
        onFailedAttempt: (error) => {
          console.warn(`[BaseScraper] Fetch attempt ${error.attemptNumber} failed for ${url}. ${error.retriesLeft} retries left.`);
        },
      }
    );
  }

  protected async loadHtml(url: string): Promise<cheerio.CheerioAPI> {
    const response = await this.fetchWithRetry(url);
    const html = await response.text();
    return cheerio.load(html);
  }

  protected async logError(type: string, message: string, url: string, originalError?: any) {
    await recordError({
      level: "error",
      type,
      message,
      module: this.constructor.name,
      url,
      context: { originalError: String(originalError) }
    });
  }

  abstract scrape(url: string): Promise<T>;
}
