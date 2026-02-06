# Nisam Video

AI-Powered Video Hub aggregating content from various platforms.

## 🌟 Key Features

### 🎬 Netflix-Style Hero Slider
- Dynamic, auto-rotating hero banner with fallbacks
- Admin-configurable content with drag-and-drop ordering
- Random video fallback when no hero images are set
- Responsive design with optimized image loading

### 🔍 Advanced Video Discovery
- AI-powered categorization and tagging (simulated)
- Multi-language support (Serbian Latin & English)
- Robust search with category/tag filters
- Dedicated pages for categories, tags, and popular content
- Support for YouTube Shorts and TikTok videos

### 📱 Progressive Web App (PWA)
- Installable on mobile/desktop devices
- Offline capability with service worker caching
- Manifest.json for native app-like experience
- Responsive design for all screen sizes

### 🛠️ Comprehensive Admin Panel
- Secure authentication with session management
- Video, category, and tag management
- Hero slider configuration
- SEO settings with dynamic meta tags
- Cache management and system settings
- Activity logs and error monitoring
- Data export capabilities
- About page editor with markdown support
- Custom code injection for head/body

### 🤖 AI Integration
- Auto-categorization using AI (simulated)
- AI re-categorization tool for existing content
- Smart content organization

### 📈 Analytics & Performance
- Dashboard with statistics and metrics
- Performance monitoring with caching strategies
- Error tracking and reporting
- Server-side LRU caching with configurable TTLs

### 🔒 Security & SEO
- Session-based authentication (transitioning to Passport.js)
- Comprehensive SEO with JSON-LD Structured Data
- Dynamic sitemaps and robots.txt
- Canonical URLs and hreflang tags
- Open Graph and Twitter Card meta tags

## 🏗️ Architecture

- **Backend**: Node.js, Express
- **Frontend**: React, Vite, Tailwind CSS, Shadcn UI
- **Database**: PostgreSQL (Supabase), Drizzle ORM
- **Authentication**: Session-based (transitioning to Passport.js)
- **Deployment**: Vercel
- **Caching**: LRU server-side, TanStack Query client-side
- **Scraping**: Cheerio for YouTube, Puppeteer for TikTok
- **AI**: OpenAI (simulated) for categorization

## ⚙️ Setup

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

## 🧪 Testing

Run unit and integration tests:
```bash
npm test
```

## 📁 Project Structure

- `server/`: Backend logic (Routes, Storage, Scheduler)
- `client/`: Frontend React application
- `shared/`: Shared schemas (Zod) and types
- `tests/`: Vitest test suite
- `migrations/`: Database migrations
- `docs/`: Documentation files

## 🚀 Features

- **Video Aggregation**: Scrapes and aggregates videos from YouTube and TikTok
- **Categorization**: Auto-categorization using AI (simulated)
- **Localization**: Multi-language support for metadata
- **Admin Dashboard**: Manage videos, scrape jobs, and settings
- **SEO Optimization**: Dynamic meta tags, sitemaps, and structured data
- **PWA Support**: Installable progressive web app with offline capability
- **Analytics**: Dashboard with statistics and metrics
- **Error Handling**: Comprehensive error tracking and reporting
- **Performance**: Optimized caching and database queries

## 📱 PWA Features

Our application is a full-featured Progressive Web App with:

- **Installability**: Can be installed on mobile/desktop devices
- **Offline Support**: Service worker caches essential assets and content
- **App-like Experience**: Standalone display mode with custom splash screen
- **Push Notifications**: (Planned) Future support for push notifications
- **Background Sync**: (Planned) Future support for background data sync

### Service Worker Capabilities
- Caches static assets and key pages
- Provides offline fallback page
- Skips cache for API requests
- Automatic cache updates and cleanup

### Manifest Features
- Custom app name and icons
- Theme colors matching brand
- Standalone display mode
- Orientation flexibility

## 🔧 Admin Panel Capabilities

The admin panel provides comprehensive control over the application:

### Content Management
- Video management with bulk operations
- Category and tag management with localization
- Hero slider configuration with preview
- Playlist creation and management

### System Settings
- Cache management and invalidation
- SEO settings with dynamic meta tags
- System configuration (maintenance mode, etc.)
- Custom code injection for advanced customization

### Monitoring & Analytics
- Activity logs with detailed tracking
- Error logs with filtering and search
- Performance metrics and caching statistics
- Data export capabilities

### AI Tools
- AI-powered content categorization
- Re-categorization of existing content
- Smart tagging suggestions

## 🎨 UI/UX Features

### Responsive Design
- Mobile-first approach
- Tablet and desktop optimizations
- Touch-friendly interfaces
- Keyboard navigation support

### Accessibility
- WCAG 2.1 AA compliance
- Screen reader support
- Keyboard navigation
- Proper contrast ratios

### Performance Optimizations
- Lazy loading for images and components
- Code splitting for faster initial loads
- Efficient caching strategies
- Optimized database queries

## 📊 Analytics & Monitoring

### Built-in Analytics
- Video view tracking
- User engagement metrics
- Performance monitoring
- Error tracking and reporting

### Third-party Integration
- Google Analytics support
- Custom analytics event tracking
- Performance monitoring tools

## 🔒 Security Features

### Authentication
- Session-based authentication
- Secure password handling
- Role-based access control

### Data Protection
- Encrypted database connections
- Input validation and sanitization
- Protection against common web vulnerabilities

### Privacy
- GDPR-compliant data handling
- User data export capabilities
- Cookie consent management

## 🚀 Deployment

### Vercel Deployment
- Automatic deployments on push
- Preview deployments for pull requests
- Custom domain support
- SSL certificates

### Environment Configuration
- Development, staging, and production environments
- Environment-specific configurations
- Secret management

## 🧪 Testing Strategy

### Unit Testing
- Component testing with React Testing Library
- Utility function testing
- API endpoint testing

### Integration Testing
- Database integration tests
- API integration tests
- End-to-end workflow tests

### Performance Testing
- Load testing capabilities
- Performance benchmarking
- Cache effectiveness monitoring

## 📚 Documentation

### Developer Documentation
- Architecture overview
- API documentation
- Component guides
- Contribution guidelines

### User Documentation
- Admin panel guides
- Feature walkthroughs
- Troubleshooting guides

## 🔄 Future Enhancements

### Planned Features
- Enhanced AI categorization with real OpenAI integration
- Push notification support
- Background sync capabilities
- Advanced analytics dashboard
- User accounts and favorites
- Social sharing features
- Advanced search with filters
- Video recommendations

### Scalability Improvements
- Database sharding strategies
- CDN integration
- Microservice architecture
- Load balancing

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for details on how to get started.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Thanks to all contributors who have helped shape this project
- Special thanks to the open-source community for the amazing tools we use