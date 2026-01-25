# Cloudflare Deployment Guide for nisam.video

This guide explains how to deploy nisam.video to Cloudflare Pages with optimal performance.

## Prerequisites

1. Cloudflare account
2. Neon PostgreSQL database (already configured)
3. GitHub repository connected to Cloudflare Pages

## Deployment Steps

### 1. Configure Build Settings

In your Cloudflare Pages project settings:

**Build command:**

```bash
npm run build
```

**Build output directory:**

```
dist/public
```

**Root directory:**

```
/
```

### 2. Environment Variables

Add these environment variables in Cloudflare Pages settings:

**Required:**

- `DATABASE_URL` - Your Neon PostgreSQL connection string
- `SESSION_SECRET` - Random secret key for sessions (generate with `openssl rand -base64 32`)
- `NODE_ENV` - Set to `production`

**Optional:**

- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (if using AI features)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL

### 3. Database Configuration

The app is optimized for Cloudflare with:

✅ **Neon Serverless Driver** - HTTP/fetch-based connections (no WebSocket needed)
✅ **Connection Pooling** - Configured for edge runtime (max 1 connection per worker)
✅ **Pipeline Mode** - Optimized for Cloudflare's connection model

No additional database configuration needed!

### 4. Caching Strategy

The app implements Cloudflare-optimized caching:

**Static Assets (JS, CSS, images):**

- Cache-Control: `public, max-age=31536000, immutable`
- Cached forever with content hashing

**HTML Pages:**

- Browser: `max-age=0, must-revalidate`
- Cloudflare Edge: `max-age=3600` (1 hour)

**API Responses:**

- No caching by default
- Can be customized per endpoint

### 5. Performance Optimizations

**Already Configured:**

- ✅ Trust proxy headers (Cloudflare's CF-Connecting-IP)
- ✅ Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- ✅ Aggressive static asset caching
- ✅ Database connection pooling
- ✅ Session persistence via PostgreSQL

**Cloudflare Features to Enable:**

- 🚀 Auto Minify (JavaScript, CSS, HTML)
- 🚀 Brotli compression
- 🚀 Early Hints
- 🚀 HTTP/3 (QUIC)
- 🚀 0-RTT Connection Resumption

### 6. Custom Domain

1. Add your custom domain in Cloudflare Pages
2. Update sitemap URLs in admin panel
3. Configure DNS in Cloudflare:
   - A record: `@` pointing to Cloudflare Pages
   - CNAME record: `www` pointing to your Pages domain

### 7. Deploy

```bash
# Build locally to test
npm run build

# Push to GitHub
git push origin main

# Cloudflare Pages will auto-deploy
```

## Monitoring

**Cloudflare Analytics:**

- Page views and performance
- Geographic distribution
- Cache hit rates

**Application Logs:**
Check Cloudflare Pages deployment logs for:

- Build output
- Runtime errors
- Database connection issues

## Troubleshooting

### Database Connection Issues

If you see connection errors:

1. Verify `DATABASE_URL` is set correctly
2. Ensure Neon database allows connections from Cloudflare IPs
3. Check connection string format: `postgresql://...`

### Session Issues

If sessions aren't persisting:

1. Verify `SESSION_SECRET` environment variable is set
2. Check PostgreSQL connection is stable
3. Ensure `session` table exists in database

### Build Failures

Common issues:

- Missing environment variables
- TypeScript errors (run `npm run check` locally)
- Missing dependencies (verify package.json)

## Performance Tips

1. **Enable Cloudflare Caching Rules:**

   - Cache static assets for max duration
   - Bypass cache for admin panel (/admin/\*)
   - Cache API responses selectively

2. **Use Cloudflare Workers (Optional):**

   - Add custom caching logic
   - Implement rate limiting
   - Add authentication middleware

3. **Database Query Optimization:**
   - Use connection pooling efficiently
   - Implement query result caching
   - Optimize slow queries with indexes

## Security Checklist

- ✅ HTTPS enforced (Cloudflare default)
- ✅ Security headers configured
- ✅ Sessions use secure cookies
- ✅ Admin panel requires authentication
- ✅ Environment secrets not exposed
- ✅ SQL injection prevention (Drizzle ORM)
- ✅ XSS protection headers

## Support

For issues specific to:

- **Cloudflare Pages**: Check Cloudflare dashboard logs
- **Database**: Check Neon dashboard
- **Application**: Check server logs in Cloudflare Pages

## Next Steps

After deployment:

1. Test all functionality on production URL
2. Configure custom domain
3. Enable Cloudflare analytics
4. Set up monitoring alerts
5. Configure backups for database
6. Test admin panel functionality
7. Verify video playback works
8. Check SEO meta tags are correct

---

**Estimated deployment time:** 5-10 minutes  
**Estimated build time:** 2-3 minutes  
**Cold start time:** <100ms with Neon serverless

Your nisam.video app is now optimized for Cloudflare's edge network! 🚀
