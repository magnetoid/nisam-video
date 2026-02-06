# Implementation Plan: Comprehensive Hero Slider System

I have analyzed the current implementation and identified the necessary changes to meet your requirements. The existing system is limited to exactly 5 static slots with no scheduling or video playback capabilities. I will refactor this into a dynamic, schedule-based system with full video support.

## 1. Database & Schema Updates (`shared/schema.ts`)
Refactor the `heroVideos` table to support dynamic scheduling and rich metadata:
- **Remove** the strict 5-slot limit and unique constraint on `slot`.
- **Rename** `slot` to `displayOrder` (integer) for sorting.
- **Add Fields**:
  - `startDate` (timestamp, nullable): For scheduling when a video should start appearing.
  - `endDate` (timestamp, nullable): For scheduling expiration.
  - `isActive` (boolean, default true): Manual toggle to show/hide.
  - `thumbnailUrl` (string, nullable): Override for the video thumbnail.
  - `videoUrl` (string, nullable): Direct video URL if different from the linked video record.
  - `duration` (integer, nullable): Duration override in seconds.

## 2. Backend Logic (`server/storage.ts` & `server/routes/admin.ts`)
- **`getHeroVideos` (Admin)**: Return all configured hero items regardless of date, sorted by `displayOrder`.
- **`getActiveHeroVideos` (Public)**: New method to fetch the current slider playlist:
  - Filter where `isActive` is true.
  - Filter where `currentDate` is between `startDate` and `endDate` (if set).
  - Sort by `displayOrder`.
- **`updateHeroVideos`**: Update validation logic to accept any number of items and save the new scheduling fields.

## 3. Admin Interface (`client/src/pages/AdminHeroManagement.tsx`)
Upgrade the management interface:
- **List Management**: Allow adding/removing an unlimited number of hero items.
- **Scheduling Controls**: Add date pickers for Start and End dates.
- **Metadata Editor**: Add inputs for custom Thumbnail, Video URL, and Duration.
- **Drag-and-Drop**: Maintain reordering functionality for `displayOrder`.
- **Validation**: Ensure end date is after start date.

## 4. Frontend Component (`client/src/components/HeroSlider.tsx`)
Create a new `HeroSlider` component (replacing or upgrading `HeroBillboard`) featuring:
- **Carousel Engine**: Use `embla-carousel-react` with the `Autoplay` plugin.
- **Video Playback**:
  - Implement a hybrid player (HTML5 `<video>` / YouTube iframe) based on the source.
  - **Auto-play**: Videos play automatically when the slide is in focus.
  - **Controls**: Mute/Unmute toggle button.
  - **Interaction**: Pause autoplay on mouse hover / touch interaction.
- **Performance**: Implement lazy loading for off-screen slides.
- **Accessibility**: Add ARIA labels, role attributes, and keyboard navigation support.
- **Responsiveness**: Ensure proper aspect ratio and scaling on mobile devices.

## 5. Analytics & SEO
- **Analytics**: specific tracking events (e.g., `hero_impression`, `hero_play`) to `client/src/lib/analytics.ts` (or create if missing) and trigger them on slide changes.
- **SEO**: Inject JSON-LD structured data (`VideoObject`) for the currently active hero video.

## 6. Testing
- **Unit Tests**: Test the date filtering logic in `storage.ts`.
- **Browser Testing**: Verify swipe gestures on mobile and keyboard navigation on desktop.
