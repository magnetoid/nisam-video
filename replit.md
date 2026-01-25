# nisam.video - AI-Powered Video Aggregation Hub

## Overview
nisam.video is a Netflix-inspired web application that aggregates YouTube video content using AI-powered categorization and intelligent search. The platform aims to provide a curated video browsing experience with features like a hero billboard, horizontal carousels, dedicated video pages, real-time search with filters, and comprehensive admin tools. The project's ambition is to become a leading platform for intelligently aggregated video content.

## User Preferences
I prefer simple language and detailed explanations. I want iterative development where I am consulted before major changes are made. I prefer to use functional programming paradigms where appropriate. Do not make changes to the `client/src/i18n/locales/en.json` file.

## System Architecture

**UI/UX Decisions:**
- **Design Inspiration**: Netflix-style interface focusing on visual appeal and intuitive navigation.
- **Color Scheme**: Netflix-inspired palette (Primary: #E50914, Background: #141414, Cards: #2F2F2F, Text: #FFFFFF).
- **Typography**: Roboto, Helvetica, sans-serif.
- **Interactions**: Hover zoom on video cards, smooth carousel scrolling, 300ms ease-in-out transitions.
- **Responsiveness**: Mobile-first design with adaptive layouts and a hamburger menu for mobile navigation.
- **Component Library**: Shadcn UI components.

**Technical Implementations & Feature Specifications:**
- **Frontend**: React + TypeScript, Tailwind CSS, TanStack Query v5 (5-minute staleTime, 10-minute gcTime).
- **Backend**: Express.js with LRU caching.
- **Video Display**: Hero Billboard, horizontal carousels, video cards with hover effects. Dedicated, SEO-compliant video pages (`/video/:slug`). Support for YouTube Shorts and TikTok videos with a dedicated `/shorts` page.
- **Content Discovery**: Robust search with category filters, dedicated pages for AI-generated categories and tags, "Popular" page.
- **Internationalization**: Serbian Latin (primary) and English (secondary) with `i18next`, language switcher, and `hreflang` tags.
- **SEO**: Comprehensive JSON-LD Structured Data, dynamic sitemaps, `robots.txt`, canonical URLs, `hreflang` tags, Open Graph, and Twitter Card meta tags. Global SEO settings configurable via admin panel.
- **Admin Panel**: Secure, authenticated interface for content, tags, scheduler, cache settings, about page editor, data export, SEO settings, system settings, and activity logs management. Includes an AI re-categorization tool and URL/slug regeneration.
- **Content Scheduling**: Automated channel scraping with configurable intervals.
- **Analytics**: Dashboard with statistics, charts, and metrics.
- **Donation Page**: Integration with Donorbox.
- **Progressive Web App (PWA)**: Full PWA support with service worker, web manifest, offline capability, and mobile installation support, configurable via admin.
- **About Page**: Customizable `/about` page with bilingual content and admin editor with markdown support.
- **Custom Code Injection**: Admin-configurable fields for injecting custom HTML/JS into `<head>`, after `<body>`, and before `</body>`.

**System Design Choices:**
- **Database**: PostgreSQL with Drizzle ORM.
- **AI Integration**: OpenAI (GPT-5) via Replit AI Integrations for video categorization and tagging.
- **Scraping**: Cheerio for YouTube channel data.
- **Monorepo Structure**: `client/`, `server/`, and `shared/` directories.
- **Database Schema**: Tables for `channels`, `videos`, `categories`, `tags`, `video_categories`, `playlists`, `playlist_videos`, `scheduler_settings`, `seo_settings`, `systemSettings`, and `activityLogs`.
- **Performance Optimization**: Enterprise-grade server-side LRU caching with configurable TTLs, automatic invalidation, and statistics tracking. Frontend TanStack Query caching. Batch endpoints for performance. Cloudflare edge caching with `s-maxage`, `stale-while-revalidate`, and ETag support.

## External Dependencies
- **Database**: PostgreSQL (Neon).
- **ORM**: Drizzle ORM.
- **AI**: OpenAI (GPT-5) via Replit AI Integrations.
- **Web Scraping**: Cheerio.
- **Session Management (Production)**: `connect-pg-simple`.
- **Scheduled Tasks**: `node-cron`.
- **Internationalization**: `i18next`.
- **Donations**: Donorbox.