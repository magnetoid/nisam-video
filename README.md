# Nisam Video

AI-Powered Video Hub aggregating content from various platforms.

## Architecture

- **Backend**: Node.js, Express
- **Frontend**: React, Vite, Tailwind CSS, Shadcn UI
- **Database**: PostgreSQL (Supabase), Drizzle ORM
- **Authentication**: Session-based (transitioning to Passport.js)
- **Deployment**: Vercel

## Setup

1. **Clone the repository**
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Environment Variables**:
   Create a `.env` file with:
   ```env
   DATABASE_URL="postgres://user:pass@host:port/db?sslmode=require"
   SESSION_SECRET="your-secret"
   OPENAI_API_KEY="sk-..." (Optional)
   ADMIN_USERNAME="admin"
   ADMIN_PASSWORD="password"
   ```
4. **Database Setup**:
   ```bash
   npm run db:push
   ```
5. **Run Development Server**:
   ```bash
   npm run dev
   ```

## Testing

Run unit and integration tests:
```bash
npm test
```

## Project Structure

- `server/`: Backend logic (Routes, Storage, Scheduler)
- `client/`: Frontend React application
- `shared/`: Shared schemas (Zod) and types
- `tests/`: Vitest test suite
- `migrations/`: Database migrations

## Features

- **Video Aggregation**: Scrapes and aggregates videos.
- **Categorization**: Auto-categorization using AI (simulated).
- **Localization**: Multi-language support for metadata.
- **Admin Dashboard**: Manage videos, scrape jobs, and settings.
