<div align="center">

# nisam.video

### AI-Powered Video Aggregation Platform

A full-stack, Netflix-style video hub that scrapes, categorizes, and serves content from YouTube and TikTok — powered by artificial intelligence, built for performance, and designed for scale.

[![Live Demo](https://img.shields.io/badge/Live-nisam.video-E50914?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxwb2x5Z29uIHBvaW50cz0iNSAzIDIwIDEyIDUgMjEgNSAzIj48L3BvbHlnb24+PC9zdmc+)](https://nisam.video)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

<br />

[View Live Demo](https://nisam.video) &nbsp;&middot;&nbsp; [Report Bug](https://github.com/magnetoid/nisam-video/issues) &nbsp;&middot;&nbsp; [Request Feature](https://github.com/magnetoid/nisam-video/issues)

</div>

<br />

---

## Table of Contents

- [What is nisam.video?](#what-is-nisamvideo)
- [Tech Stack](#tech-stack)
- [Features at a Glance](#features-at-a-glance)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Docker Deployment](#docker-deployment)
- [Public Pages](#public-pages)
- [Admin Dashboard](#admin-dashboard)
- [AI Engine](#ai-engine)
- [Scraping Pipeline](#scraping-pipeline)
- [Caching Architecture](#caching-architecture)
- [SEO System](#seo-system)
- [Internationalization](#internationalization)
- [Security](#security)
- [Analytics & Monitoring](#analytics--monitoring)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

---

## What is nisam.video?

**nisam.video** is a self-hosted video aggregation platform that automatically imports videos from YouTube channels and TikTok profiles, uses AI to categorize and tag every piece of content in multiple languages, and presents it all through a polished, Netflix-inspired interface.

It solves a simple problem: you have dozens of favorite YouTube channels and TikTok creators, and you want a single place to browse, search, and discover their content — organized by intelligent categories rather than platform algorithms.

**Who is it for?**
- Content curators building niche video libraries
- Communities aggregating educational or entertainment content
- Developers looking for a production-grade full-stack reference app
- Anyone who wants their own "personal Netflix" for web video

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Shadcn/Radix UI | Responsive SPA with code-splitting and lazy loading |
| **Routing** | Wouter | Lightweight client-side routing with language prefixes |
| **State** | TanStack Query (React Query) | Server state management with automatic caching and refetching |
| **Backend** | Express.js, TypeScript | RESTful API with middleware pipeline |
| **Database** | PostgreSQL 16, Drizzle ORM | Type-safe relational data with automatic migrations |
| **Connection Pool** | PgBouncer | Transaction-mode pooling for high-concurrency deployments |
| **Cache** | Redis 7 + in-memory LRU | Two-tier caching with ETag support and Cloudflare edge headers |
| **AI** | OpenAI API or Ollama (local) | Video categorization, tagging, translation, and summarization |
| **Scraping** | Cheerio (YouTube), Puppeteer + Stealth (TikTok) | Headless content extraction with pagination and deduplication |
| **Auth** | express-session, bcrypt, connect-pg-simple | Session-based authentication with PostgreSQL-backed storage |
| **i18n** | i18next, react-i18next | Runtime translations with HTTP backend and database storage |
| **PWA** | Web App Manifest, Service Worker | Installable on mobile and desktop with offline support |
| **Deployment** | Docker, Docker Compose, Coolify, Vercel | Multi-target deployment with health checks |

---

## Features at a Glance

| Category | Highlights |
|---|---|
| **Viewing Experience** | Hero carousel, category carousels, similar video recommendations, likes, view tracking, shorts page, responsive grid layouts |
| **AI Intelligence** | Auto-categorization into 5 categories and 10 tags per video, bilingual output (EN + SR), bulk processing, provider choice (OpenAI or Ollama) |
| **Content Ingestion** | YouTube channel scraping with pagination, TikTok profile scraping via Puppeteer, incremental sync, video deduplication, description enrichment |
| **Admin Panel** | 20+ admin pages covering channels, videos, categories, tags, SEO, analytics, hero management, automation, cache, users, languages, email, AI settings |
| **SEO** | Dynamic sitemap, robots.txt, JSON-LD structured data, Open Graph, Twitter Cards, per-page meta tags, keyword tracking, A/B testing, redirect management |
| **Performance** | Two-tier cache (memory + Redis), ETag/304 responses, Cloudflare edge cache headers, gzip compression, code splitting, lazy loading |
| **Security** | Helmet CSP, Cloudflare Turnstile CAPTCHA, rate limiting (5 tiers), CSRF protection, bcrypt passwords, session fixation prevention |
| **Internationalization** | Multi-language content and UI, database-driven translations, language-prefixed routing, AI-powered auto-translation |
| **Monitoring** | Error fingerprinting and deduplication, critical error webhooks, performance metrics, health probes, audit logging |
| **Deployment** | Docker multi-stage build, Docker Compose with PgBouncer and Redis, Coolify labels, Vercel-compatible, health check endpoints |

---

## Architecture

```
                                    ┌──────────────────┐
                                    │   Cloudflare CDN  │
                                    │   (Edge Cache)    │
                                    └────────┬─────────┘
                                             │
                                    ┌────────▼─────────┐
                                    │   React Frontend  │
                                    │   (Vite + SPA)    │
                                    │                   │
                                    │  - TanStack Query │
                                    │  - Shadcn UI      │
                                    │  - i18next         │
                                    │  - Wouter Router  │
                                    └────────┬─────────┘
                                             │ fetch + credentials
                                    ┌────────▼─────────┐
                                    │  Express.js API   │
                                    │                   │
                                    │  Middleware Chain: │
                                    │  Helmet → CORS →  │
                                    │  Rate Limit →     │
                                    │  Session → Cache  │
                                    │  → Routes         │
                                    └──┬─────┬─────┬───┘
                                       │     │     │
                          ┌────────────┘     │     └────────────┐
                          │                  │                  │
                 ┌────────▼───────┐ ┌───────▼────────┐ ┌──────▼───────┐
                 │  PostgreSQL 16  │ │    Redis 7     │ │  AI Provider  │
                 │  (via PgBouncer)│ │  (Cache/Sessions│ │ OpenAI/Ollama│
                 │                 │ │   Rate Limits)  │ │              │
                 │  - Videos       │ │                 │ │ - Categorize │
                 │  - Channels     │ │  - Memory LRU   │ │ - Tag        │
                 │  - Categories   │ │  - HTTP Cache    │ │ - Translate  │
                 │  - Tags         │ │  - ETag Support  │ │ - Summarize  │
                 │  - Sessions     │ │                 │ │              │
                 │  - Error Logs   │ └─────────────────┘ └──────────────┘
                 │  - SEO Data     │
                 │  - Translations │
                 └─────────────────┘

                 ┌─────────────────────────────────────────┐
                 │           Background Services            │
                 │                                         │
                 │  - Scheduler (node-cron)                │
                 │  - YouTube Scraper (Cheerio)            │
                 │  - TikTok Scraper (Puppeteer + Stealth) │
                 │  - AI Categorization Pipeline           │
                 │  - Cache Warming on Startup             │
                 │  - Error Retention Cleanup              │
                 └─────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **PostgreSQL** 14+ (16 recommended)
- **Redis** 6+ (optional but recommended for production)
- **npm** or **pnpm**

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/magnetoid/nisam-video.git
cd nisam-video

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env
# Edit .env with your database credentials (see Environment Variables below)

# 4. Push database schema
npm run db:push

# 5. Start development server
npm run dev
```

The app will be available at `http://localhost:5001`. Log into the admin panel at `/admin` with the credentials you set in `.env`.

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production (client + server + locales) |
| `npm start` | Run production build |
| `npm run check` | TypeScript type checking |
| `npm test` | Run test suite (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run db:push` | Push schema changes to database |

---

## Environment Variables

Create a `.env` file in the project root. Required variables are marked with **\***.

### Core

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` **\*** | PostgreSQL connection string | — |
| `SESSION_SECRET` **\*** | Min 32 characters in production | Auto-generated in dev |
| `ADMIN_USERNAME` **\*** | Admin login username | — |
| `ADMIN_PASSWORD` **\*** | Admin login password | — |
| `PORT` | Server port | `5001` |
| `NODE_ENV` | `development` or `production` | `development` |

### Optional Services

| Variable | Description | Default |
|---|---|---|
| `REDIS_URL` | Redis connection string (`redis://` or `rediss://` for TLS) | — |
| `OPENAI_API_KEY` | OpenAI API key for AI features | — |
| `OLLAMA_URL` | Ollama server URL | `http://localhost:11434` |

### Database

| Variable | Description | Default |
|---|---|---|
| `DB_SSL` | Set to `0` to disable SSL | SSL enabled |
| `DB_SSL_REJECT_UNAUTHORIZED` | Set to `false` for self-signed certs | `true` |

### Deployment

| Variable | Description | Default |
|---|---|---|
| `BASE_URL` | Public URL of the app | — |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | — |
| `DISABLE_SCHEDULER` | Set to `1` to disable background scraping | `0` |
| `ALLOW_DEV_DEFAULT_ADMIN` | Set to `1` to use admin/admin in dev | `0` |
| `PUBLIC_ERROR_LOGS_TOKEN` | Token to access public error logs | — |
| `ERROR_NOTIFICATION_WEBHOOK_URL` | Webhook for critical error alerts | — |
| `KV_DISABLE_BACKGROUND_TASKS` | Set to `1` to disable KV cleanup | `0` |

### Scraping

| Variable | Description | Default |
|---|---|---|
| `SCRAPE_BATCH_SIZE` | Videos to process per batch | `10` |
| `SCRAPE_DELAY_MS` | Min delay between requests (ms) | `1000` |
| `SCRAPE_DELAY_MAX_MS` | Max delay between requests (ms) | `3000` |

---

## Docker Deployment

### Docker Compose (Recommended)

The included `docker-compose.yml` sets up the full stack: PostgreSQL 16, PgBouncer (connection pooling), Redis 7, and the application.

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f app

# Stop
docker compose down
```

**Services included:**

| Service | Image | Purpose |
|---|---|---|
| `postgres` | postgres:16-alpine | Primary database with health checks |
| `pgbouncer` | edoburu/pgbouncer | Connection pooling (transaction mode, max 50 connections) |
| `redis` | redis:7-alpine | Cache + sessions (256MB max, LRU eviction, AOF persistence) |
| `app` | Node 20 Alpine | Application with Chromium for Puppeteer |

### Standalone Docker

```bash
docker build -t nisam-video .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgres://..." \
  -e SESSION_SECRET="..." \
  -e ADMIN_USERNAME="admin" \
  -e ADMIN_PASSWORD="..." \
  nisam-video
```

### Coolify

The Docker Compose file includes Coolify-compatible Traefik labels. Set your `SERVICE_FQDN_APP` and the app will be routed automatically.

### Vercel

The app is Vercel-compatible with caveats:
- TikTok scraping is **not supported** (requires Puppeteer/Chromium)
- Scheduler is automatically disabled
- Cache warming is skipped to avoid cold-start delays

---

## Public Pages

Every page is server-state cached, code-split, and includes full SEO metadata.

| Route | Page | Description |
|---|---|---|
| `/` | **Home** | Hero carousel, recent videos, trending videos, category carousels |
| `/video/:slug` | **Video** | Embedded player, metadata, likes, view tracking, similar recommendations |
| `/categories` | **Categories** | Browse all categories with video counts |
| `/category/:slug` | **Category** | Videos filtered by category |
| `/channels` | **Channels** | All tracked channels with thumbnails |
| `/channels/:slug` | **Channel** | Channel profile with all its videos |
| `/tags` | **Tags** | Tag cloud with images |
| `/tag/:slug` | **Tag** | Videos filtered by tag |
| `/popular` | **Popular** | Most viewed and liked content |
| `/shorts` | **Shorts** | YouTube Shorts and TikTok videos with platform filter |
| `/login` | **Login** | Authentication with optional Turnstile CAPTCHA |
| `/register` | **Register** | User registration with password requirements |
| `/settings` | **Settings** | User preferences and language selection |
| `/about` | **About** | Customizable about page (content set via admin) |
| `/donate` | **Donate** | Donation page |
| `/privacy` | **Privacy Policy** | Legal privacy statement |
| `/terms` | **Terms of Service** | Legal terms |
| `/faq` | **FAQ** | Frequently asked questions |
| `/sitemap.xml` | **Sitemap** | Auto-generated XML sitemap for search engines |
| `/robots.txt` | **Robots** | Configurable crawler instructions |

---

## Admin Dashboard

The admin panel at `/admin` provides full control over every aspect of the platform. All admin routes require authentication.

### Channel Management (`/admin/channels`)
Add YouTube channels and TikTok profiles for scraping. Configure channel metadata, view per-channel statistics, and manage the channel recommendation inbox where users can suggest new channels.

### Video Management (`/admin/videos`)
Full CRUD for the video library. Edit titles, descriptions, and thumbnails. Assign categories and tags. Bulk operations: categorize, tag, or delete multiple videos at once. Trigger AI categorization for individual videos or process all uncategorized content in one click.

### Category & Tag Management (`/admin/categories`, `/admin/tags`)
Create and edit categories and tags with multi-language translations. Each category and tag supports English and Serbian Latin names, slugs, and descriptions. Tags can have associated images for visual browsing.

### Automation (`/admin/automation`)
Control the scraping pipeline. Start manual scrape jobs (full sync, single channel, or incremental). Monitor active jobs with real-time progress via Server-Sent Events. View job history with filtering by status, date, and search. Configure the automated scheduler: interval (hours), timezone, and enable/disable.

### Hero Management (`/admin/hero`)
Configure the homepage hero carousel. Select featured videos, set display order, customize rotation interval and animation type (fade or slide). Configure fallback images and random rotation.

### SEO (`/admin/seo`, `/admin/seo/enhanced`)
Comprehensive SEO toolkit:
- **Meta Tags**: Create custom title, description, OG, and Twitter Card tags for any page
- **Redirects**: Manage 301/302 redirects with hit tracking
- **Keywords**: Track target keywords with search volume and ranking
- **A/B Tests**: Test different meta tag variations
- **Competitors**: Monitor competitor domains
- **Audit Logs**: Track all SEO changes
- **Local SEO**: Business name, address, phone, hours, coordinates
- **Sitemap**: Auto-generated with configurable priorities
- **Robots.txt**: Editable directly from admin

### Analytics (`/admin/analytics`)
View platform metrics: total videos, channels, categories, and tags. Daily growth charts, top performing categories, channel performance rankings, and tag frequency analysis. Filterable by date range.

### System Settings (`/admin/settings`)
Six configuration tabs:

| Tab | Controls |
|---|---|
| **General** | Maintenance mode, items per page, PWA toggle, registration toggle, client error logging |
| **API Keys** | YouTube Data API v3 key for channel enrichment |
| **Security** | Cloudflare Turnstile site key and secret key |
| **PWA & Mobile** | App name, short name, description, theme color, background color, icons (192x192, 512x512) |
| **Email** | SMTP and IMAP configuration (host, port, username, password, TLS) |
| **GA4 & GTM** | Google Analytics 4 ID, Google Tag Manager ID, custom head/body code injection |

### Cache Settings (`/admin/cache`)
Enable/disable the cache globally. Configure TTL per content type: videos, channels, categories, and general API responses. View cache statistics (hits, misses, evictions). Manual cache clear button.

### Error Logs (`/admin/logs`)
Browse all application errors with full context. Filter by level (debug through critical), type, module, user, date range, and free text search. Bookmark important errors for follow-up. View stack traces, request details, and user agent information. Errors are fingerprinted and deduplicated — the count and last-seen time update automatically.

### AI Settings (`/admin/ai-settings`)
Choose between OpenAI and Ollama as the AI provider. Configure API keys, base URLs, and model selection. Test connectivity from the admin panel.

### Languages (`/admin/languages`)
Add and remove supported languages. Set the default language and configure URL prefixes (e.g., `/en/` for English). Trigger AI-powered auto-translation of missing UI keys.

### Users (`/admin/users`)
View registered users, manage roles, and delete accounts.

### Data Export (`/admin/export`)
Export videos, channels, and categories as JSON or CSV.

### TikTok (`/admin/tiktok`)
Manage TikTok profiles separately. Add profile URLs, trigger scraping, and monitor TikTok-specific content.

---

## AI Engine

The AI system supports two providers, configurable from the admin panel:

| Provider | Best For | Requirements |
|---|---|---|
| **OpenAI** | Production use, high accuracy | API key, internet access |
| **Ollama** | Self-hosted, private, free | Local Ollama server with a model like Llama 3 |

### What the AI Does

**Video Categorization** — Given a video title and description, the AI returns:
- Up to **5 categories** in English and Serbian Latin
- Up to **10 tags** in English and Serbian Latin
- Automatic fallback translation if only one language is returned

**Video Summarization** — Generates 150-word summaries for metadata enrichment.

**SEO Metadata** — Auto-generates optimized titles (max 60 chars), descriptions (max 160 chars), and keywords (5-10).

**Translation** — Batch translates content between English and Serbian Latin for bilingual content management.

### Processing Pipeline

1. Admin triggers categorization (single video, bulk, or bulk-missing)
2. AI analyzes title + description with a structured prompt
3. Response is parsed as JSON (with retry logic and cleanup)
4. Categories are matched to existing ones or created with slugs
5. Tags are created with translations
6. Primary category is assigned for sorting
7. All changes are persisted to PostgreSQL

Concurrency: 2 parallel AI requests for bulk operations. 3 retries with exponential backoff on failure.

---

## Scraping Pipeline

### YouTube Scraping

The YouTube scraper works without an API key by parsing YouTube's server-rendered HTML:

1. Fetches the channel page and extracts `ytInitialData`
2. Parses video grids from Newest, Popular, and Oldest tabs
3. Follows continuation tokens for pagination (up to 200 videos per channel)
4. Extracts: video ID, title, description snippet, view count, publish date, duration, thumbnail, and Shorts detection
5. Deduplicates against existing videos in the database
6. Generates SEO-friendly slugs for each new video

**Incremental sync**: On subsequent runs, only new videos (by video ID) are imported.

**Description enrichment**: A separate endpoint scrapes individual video pages to replace truncated channel-level descriptions with full descriptions.

### TikTok Scraping

TikTok scraping uses Puppeteer with the stealth plugin to bypass bot detection:

1. Launches a headless Chromium browser
2. Navigates to the TikTok profile page
3. Parses `SIGI_STATE` (TikTok's hydration data) or falls back to DOM parsing
4. Extracts up to 30 videos: video ID, description, view count, duration, publish date, embed URL
5. Extracts profile metadata: username, display name, avatar, follower count

> **Note**: TikTok scraping requires a server with Chromium installed. It does not work on Vercel.

### Automation & Scheduling

The built-in scheduler (node-cron) can run scraping automatically:

- **Configurable interval**: 1, 2, 4, 6, 12, or 24 hours
- **Timezone support**: UTC, US, Europe, Asia
- **Job types**: Full sync (all channels), single channel scan, incremental (new videos only)
- **Real-time monitoring**: SSE-based progress streaming to the admin UI
- **Concurrent protection**: Only one job runs at a time

---

## Caching Architecture

nisam.video uses a **two-tier caching system** designed for both single-server and multi-instance deployments.

### Tier 1: In-Memory LRU Cache

- **Capacity**: 500 entries with LRU eviction
- **Default TTL**: 5 minutes
- **Cleanup**: Expired entries purged every 60 seconds
- **Stats**: Tracks hits, misses, and evictions

### Tier 2: Redis Cache

- **Purpose**: Shared state across multiple instances
- **Features**: TLS auto-detection, connection retry with backoff, fail-fast on errors
- **Fallback**: If Redis is unavailable, the app continues with memory cache only

### Request Flow

```
Client Request
     │
     ▼
  Memory Cache ──HIT──▶ Return (+ ETag check for 304)
     │ MISS
     ▼
  Redis Cache ──HIT──▶ Populate memory cache, return
     │ MISS
     ▼
  Execute Route Handler
     │
     ▼
  Store in Memory + Redis (async)
     │
     ▼
  Return Response (+ Cache-Control + ETag headers)
```

### What Gets Cached

| Route Pattern | Scope | TTL |
|---|---|---|
| `/api/videos/*` | Public | Configurable (default 60s API, 60s edge) |
| `/api/channels/*` | Public | Configurable (default 10 min) |
| `/api/categories/*` | Public | Configurable (default 10 min) |
| `/api/tags/*` | Public | Configurable (default 10 min) |
| `/api/system/settings` | Public | Configurable (default 3 min) |
| `/api/admin/*` (GET) | Private (per-session) | 30 seconds |

### Cache Invalidation

- **Automatic**: Any POST, PATCH, or DELETE request invalidates matching cache patterns
- **Manual**: Admin can clear all caches from the Cache Settings page
- **Edge**: Cloudflare respects `s-maxage` and `stale-while-revalidate` headers

---

## SEO System

### Automatic Features

| Feature | Description |
|---|---|
| **Dynamic Sitemap** | XML sitemap at `/sitemap.xml` with all videos, categories, channels, and tags. Priority and change frequency set per content type. Cached for 1 hour. |
| **Robots.txt** | Customizable via admin or auto-generated. Blocks `/admin` and `/api/admin`. Includes sitemap reference. |
| **JSON-LD Structured Data** | Auto-generated per page type: `VideoObject` for videos, `CollectionPage` for categories, `BreadcrumbList` for navigation, `LocalBusiness` for local SEO. |
| **Open Graph + Twitter Cards** | Dynamic OG and Twitter meta tags for every page with title, description, and image. |
| **Canonical URLs** | Configurable per page to prevent duplicate content issues. |
| **Hreflang Tags** | Automatic `<link rel="alternate" hreflang="...">` for multi-language pages. |

### Admin-Configurable

- Per-page meta tag overrides (title, description, keywords, OG, Twitter)
- 301/302 redirect management with hit tracking
- Keyword tracking with search volume, competition, and current rank
- A/B testing for meta tag variations
- Competitor domain monitoring
- SEO audit logging
- Local SEO: business name, address, phone, hours, coordinates

---

## Internationalization

### How It Works

The platform supports multiple languages at every level:

| Layer | Mechanism |
|---|---|
| **UI strings** | i18next with database-backed translations. Each language has its own namespace loaded via HTTP from `/api/locales/:lng/:ns`. |
| **Content** | Categories and tags have a translations table with per-language entries (name, slug, description). |
| **Routing** | The default language uses root paths (`/`). Additional languages use prefixed paths (`/en/`, `/sr-Latn/`). |
| **AI output** | The categorization prompt requests results in both English and Serbian Latin simultaneously. |

### Default Languages

- **Serbian Latin** (`sr-Latn`) — default
- **English** (`en`)

Additional languages can be added from `/admin/languages`. The AI can auto-translate missing UI keys into new languages.

---

## Security

### Defense in Depth

| Layer | Implementation |
|---|---|
| **HTTP Headers** | Helmet.js with strict CSP, HSTS (1 year + preload), X-Frame-Options DENY, nosniff, XSS filter, strict referrer policy |
| **CAPTCHA** | Cloudflare Turnstile on login and registration (optional, configurable via admin) |
| **Rate Limiting** | 5 tiers: standard (500/15min), auth (20/15min), API (200/min), upload (10/hour), sensitive (100/15min). Plus per-user like rate limiting (10/min). |
| **CSRF** | Session-based CSRF tokens for state-changing requests |
| **Passwords** | bcrypt with 10 salt rounds. Requirements: 8+ chars, uppercase, lowercase, digit. |
| **Sessions** | PostgreSQL-backed with memory fallback. HttpOnly, Secure, SameSite cookies. 1-week expiry with rolling renewal. Session fixation prevention via regeneration on login. |
| **Input Validation** | Zod schemas for all API inputs. Max request body: 10MB JSON, 25MB raw. |
| **CORS** | Configurable allowed origins with credentials support |
| **Error Sanitization** | Sensitive headers (Authorization, Cookie, tokens) are redacted from error logs. Context objects are recursively sanitized with depth limits. |

---

## Analytics & Monitoring

### Google Analytics & Tag Manager

Configure GA4 and GTM IDs from the admin panel. Custom code injection is available for the `<head>`, after `<body>`, and before `</body>` — useful for additional tracking scripts, Hotjar, or any third-party snippet. Custom analytics events can be defined in the admin with name, trigger type, CSS selector, and parameters.

### Error Monitoring

The built-in error monitoring system captures every server error and stores it in PostgreSQL:

- **Fingerprinting**: Errors are hashed by type + message + stack + URL to group duplicates
- **Deduplication**: Recurring errors increment a counter and update `lastSeenAt` instead of creating new rows
- **Levels**: debug, info, warn, error, critical
- **Context**: Full request details (method, URL, query, params), user agent, IP, session ID
- **Bookmarks**: Pin important errors for follow-up
- **Retention**: Configurable (1-365 days, default 30)
- **Webhooks**: Critical errors can trigger a POST to a configured webhook URL
- **Audit Trail**: Admin actions (login, user changes, data exports) are logged separately

### Health Checks

| Endpoint | Purpose |
|---|---|
| `GET /health` | Lightweight check: database status, Redis status, error rate, uptime, memory usage |
| `GET /health/deep` | Full connectivity check: actual DB query + Redis ping with latency measurements |

---

## API Reference

All endpoints return JSON. Authentication is session-based (cookie). Admin endpoints require an authenticated admin session.

### Videos

```
GET    /api/videos                    # List videos (filters: channelId, categoryId, search, tagName, lang, limit, offset, sort)
GET    /api/videos/hero               # Get hero video(s)
GET    /api/videos/carousels          # Home page data (hero, recent, trending, by category)
GET    /api/videos/:idOrSlug          # Single video with relations
GET    /api/videos/:id/similar        # Similar videos by category/tags/channel
GET    /api/videos/:id/like-status    # Check if current user liked video
POST   /api/videos/:id/like           # Like a video
DELETE /api/videos/:id/like           # Unlike a video
POST   /api/videos/:id/view           # Track a view
POST   /api/videos/batch/like-status  # Batch like status check (max 200 IDs)
PATCH  /api/videos/:id                # Update video (admin)
DELETE /api/videos/:id                # Delete video (admin)
POST   /api/videos/:id/categorize     # AI categorize (admin)
POST   /api/videos/bulk/categorize    # Bulk AI categorize (admin)
POST   /api/videos/bulk/categorize-missing  # Categorize uncategorized (admin)
POST   /api/videos/bulk/tag           # Bulk tag (admin)
DELETE /api/videos/bulk               # Bulk delete (admin)
POST   /api/videos/scrape             # Scrape single URL (admin)
POST   /api/videos/scrape-batch       # Scrape multiple URLs (admin)
POST   /api/videos/enrich-descriptions # Enrich truncated descriptions (admin)
```

### Channels

```
GET    /api/channels                  # List all channels
GET    /api/channels/:idOrSlug        # Single channel with videos
POST   /api/channels                  # Create channel (admin)
PATCH  /api/channels/:id              # Update channel (admin)
DELETE /api/channels/:id              # Delete channel (admin)
```

### Categories

```
GET    /api/categories                # List all with translations
POST   /api/admin/categories          # Create category (admin)
PATCH  /api/admin/categories/:id      # Update category (admin)
DELETE /api/admin/categories/:id      # Delete category (admin)
```

### Tags

```
GET    /api/tags                      # List all tags
GET    /api/tags/images               # Tag images
GET    /api/tag-images                # Tag image management
```

### Authentication

```
POST   /api/auth/login                # Login (with optional Turnstile)
POST   /api/auth/register             # Register (with optional Turnstile)
POST   /api/auth/logout               # Logout
GET    /api/auth/session              # Check session status
```

### System

```
GET    /api/system/settings           # Public system settings
PATCH  /api/system/settings           # Update settings (admin)
GET    /api/system/turnstile          # Turnstile config (public, no secrets)
```

### SEO

```
GET    /api/seo-settings              # SEO settings
POST   /api/admin/seo/settings        # Update SEO settings (admin)
GET    /api/admin/seo/meta-tags       # List meta tags (admin)
POST   /api/admin/seo/meta-tags       # Create/update meta tag (admin)
GET    /api/admin/seo/redirects       # List redirects (admin)
POST   /api/admin/seo/redirects       # Create redirect (admin)
GET    /api/admin/seo/keywords        # List keywords (admin)
```

### Automation

```
GET    /api/automation/jobs           # List scrape jobs (admin)
GET    /api/automation/jobs/active    # Get active job (admin)
POST   /api/automation/jobs/start     # Start scrape job (admin)
GET    /api/automation/jobs/:id/stream # SSE job progress (admin)
GET    /api/automation/scheduler/settings  # Scheduler config (admin)
POST   /api/automation/scheduler/settings  # Update scheduler (admin)
POST   /api/automation/scheduler/run-now   # Trigger now (admin)
```

### Analytics

```
GET    /api/analytics                 # Platform analytics (public)
GET    /api/admin/analytics/events    # Analytics events (admin)
POST   /api/admin/analytics/events    # Create event (admin)
```

### Languages

```
GET    /api/languages                 # Supported languages
GET    /api/locales/:lng/:ns          # Translation strings
POST   /api/admin/languages           # Add language (admin)
DELETE /api/admin/languages/:code     # Remove language (admin)
```

### Admin

```
GET    /api/admin/dashboard           # Dashboard metrics
GET    /api/admin/cache/settings      # Cache configuration
PUT    /api/admin/cache/settings      # Update cache settings
POST   /api/admin/cache/clear         # Clear all caches
GET    /api/admin/error-logs          # Error log listing
GET    /api/admin/error-logs/stream   # SSE error stream
POST   /api/admin/error-logs/bookmark # Bookmark an error
GET    /api/admin/analytics/settings  # Analytics config
PUT    /api/admin/analytics/settings  # Update analytics config
```

---

## Contributing

Contributions are welcome. Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

Please use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">

**Built by [Magnetoid](https://github.com/magnetoid)**

</div>
