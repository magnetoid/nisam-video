# Design Guidelines for nisam.video

## Design Approach

**Reference-Based Approach**: Netflix-Inspired Media Hub

Drawing from Netflix's industry-leading video browsing interface, known for its immersive content discovery experience, horizontal carousel navigation, and sophisticated hover interactions. This approach leverages Netflix's proven patterns for media consumption while adapting them for YouTube content aggregation and admin functionality.

**Key Design Principles**:

- Immersive content-first experience with minimal chrome
- Fluid horizontal browsing with category-based organization
- Progressive disclosure of video information
- Seamless transition between browsing and viewing modes

---

## Typography

**Font System**: Netflix Sans (primary), Helvetica Neue (fallback), sans-serif

**Hierarchy**:

- Hero Titles: 48px (mobile: 32px), Bold, tight letter-spacing (-0.5px)
- Section Headers: 20px, Bold, uppercase tracking (1.5px)
- Video Titles: 16px (hover: 18px), Medium weight
- Video Metadata: 14px, Regular, reduced opacity (0.8)
- Body Text: 16px, Regular, line-height 1.6
- Small Labels: 12px, Medium, uppercase tracking (1px)
- Admin Panel Headers: 24px, Bold

**Text Treatment**:

- White (#FFFFFF) for primary text
- Grey (#B3B3B3) for secondary/metadata text
- Red accent (#E50914) for interactive elements and highlights
- Text shadows on overlay text (0 2px 4px rgba(0,0,0,0.8))

---

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16, 20

**Grid Structure**:

- Container: Full-width with 16px side padding (mobile), 48px (desktop)
- Category Rows: Vertical spacing of 12 between rows
- Card Gaps: 4 horizontal spacing between video cards
- Section Padding: py-8 (mobile), py-12 (desktop)

**Breakpoint Strategy**:

- Mobile: Single column, vertical stack
- Tablet (768px): 3-4 cards visible per row
- Desktop (1024px): 5-6 cards visible per row
- Large (1440px): 6-8 cards visible per row

---

## Component Library

### Navigation Header

**Structure**: Fixed top navigation with black background (rgba(20,20,20,0.95)) and subtle backdrop blur

- Logo (left): "nisam.video" wordmark with red accent
- Primary Navigation (center): Browse, Categories, My List, Admin Panel
- Secondary Actions (right): Search icon, Notifications, Profile avatar
- Height: 64px with smooth show/hide on scroll

### Hero Section

**Layout**: Full-width billboard showcasing featured/trending video

- Background: Large video thumbnail (1920x1080) with gradient overlay (linear-gradient(90deg, #141414 30%, transparent))
- Content Area: Left-aligned within max-w-2xl container
- Title: Hero typography (48px bold)
- Description: 2-3 line excerpt, max 300 characters
- Metadata Row: Channel name, view count, category tags
- Action Buttons: Primary "Play" button (white background with red hover), Secondary "More Info" button (dark grey with white border)
- Button Styling: Blurred background (backdrop-blur-sm), rounded-lg, px-8 py-3
- Height: 70vh (mobile), 80vh (desktop)

### Video Card Component

**Netflix-Style Card with Hover Expansion**:

- Base State: 16:9 aspect ratio thumbnail with subtle rounded corners (rounded-md)
- Thumbnail: High-quality image with lazy loading
- Title Overlay: Bottom gradient overlay with title (opacity 0 initially)
- Hover State: Scale transform (1.05), z-index elevation, expand vertically to show metadata
- Hover Content: Title, channel name, view count, duration, category tags
- Transition: 300ms ease-in-out transform

### Horizontal Carousel

**Scrollable Category Rows**:

- Section Header: Category name (20px bold uppercase) with "See All" link
- Scroll Container: Overflow-x hidden with smooth scroll behavior
- Navigation Arrows: Floating left/right buttons (appear on row hover)
- Scroll Snap: snap-x snap-mandatory for precise card alignment
- Peek Effect: Show partial next card (16px) to indicate more content

### Video Detail Modal

**Full-Screen Overlay Experience**:

- Background: Dark overlay (rgba(0,0,0,0.9)) with backdrop blur
- Content Container: max-w-6xl centered with close button (top-right)
- Video Player: 16:9 embedded YouTube player, full-width
- Metadata Section: Below player with title, channel info, description
- AI Tags: Horizontal pill-style tags with subtle backgrounds
- Similar Videos: Grid of 3-4 related content cards
- Height: Auto with max-height 90vh, scrollable content

### Admin Panel Interface

**Dashboard Layout**:

- Sidebar Navigation: Fixed left sidebar (240px wide) with dark background
  - Menu Items: Channels, Videos, Categories, Analytics, Settings
  - Active State: Red left border (4px) with highlighted background
- Main Content Area: Right of sidebar with full-height scroll
- Top Bar: Breadcrumb navigation, action buttons, user profile
- Content Cards: White text on dark grey cards (#2F2F2F) with 8 padding
- Data Tables: Striped rows, hover states, sortable columns
- Action Buttons: Icon + text combinations, red accent for primary actions

### Search Interface

**Overlay Search Experience**:

- Trigger: Header search icon
- Expand: Full-width overlay (slide down from top)
- Input Field: Large centered search box (48px height) with auto-focus
- Suggestions: Live results grid appearing below input
- Filters: Category chips, sort options (relevance, date, views)
- Results: Same card grid layout as main browse interface

### Channel Management

**Admin CRUD Interface**:

- Channel List: Table view with thumbnail, name, video count, last crawled
- Add Channel: Modal form with URL input, validation feedback
- Channel Card: Grid layout showing stats, scraping status, actions
- Scraping Status: Visual indicators (idle, crawling, complete) with progress bars
- Bulk Actions: Select multiple, batch operations toolbar

### Category Organization

**Tag and Filter System**:

- Category Pills: Horizontal scrollable row of rounded tags
- Active Filter: Red background with white text
- Multi-Select: Allow combining categories
- Tag Cloud: Visual weight based on video count
- Color Coding: Subtle background variations per category type

---

## Interactive Patterns

### Hover Effects

- Cards: Scale (1.05) + shadow elevation + metadata reveal
- Buttons: Background color shift + subtle scale (1.02)
- Navigation: Underline slide-in effect (red accent)
- Carousel Arrows: Fade in on row hover, pulse on hover

### Loading States

- Skeleton screens matching card layouts
- Shimmer effect on loading placeholders
- Progressive image loading with blur-up technique
- Spinner for scraping operations (centered in card)

### Transitions

- Page transitions: Fade (200ms)
- Modal open/close: Scale + opacity (300ms)
- Carousel scroll: Smooth scroll behavior with easing
- Hover states: 300ms ease-in-out

---

## Icons

**Library**: Heroicons (via CDN)

- Search: magnifying-glass
- Play: play-circle
- Info: information-circle
- Close: x-mark
- Menu: bars-3
- Chevrons: chevron-left/right (carousel navigation)
- Settings: cog-6-tooth
- User: user-circle
- Add: plus-circle

---

## Images

**Hero Section**: Large featured video thumbnail (1920x1080 minimum), cinematic quality image representing trending/featured content. Applied as background with gradient overlay.

**Video Cards**: 16:9 thumbnail images for each video (1280x720 recommended), high-quality screenshots or YouTube-provided thumbnails.

**Channel Avatars**: Circular profile images (120x120) for channel identities in admin panel and video metadata.

**Empty States**: Placeholder illustrations for "No videos found" or "Add your first channel" states - simple vector graphics with dark theme compatibility.
