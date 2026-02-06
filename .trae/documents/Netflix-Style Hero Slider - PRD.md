## 1. Product Overview
A Netflix-style hero image slider component for the home page.
It supports autoplay, manual navigation, responsive layout, lazy-loading, and strong keyboard/ARIA accessibility.

## 2. Core Features

### 2.1 Feature Module
Our slider requirements consist of the following main pages:
1. **Home page**: hero slider region, slide content rendering, navigation controls, accessibility support.

### 2.2 Page Details
| Page Name | Module Name | Feature description |
|-----------|-------------|---------------------|
| Home page | Hero slider container | Render a full-width hero slider region that adapts to viewport size. |
| Home page | Slide data & fallback | Use provided slide data when available; otherwise show exactly 5 predefined fallback slides. |
| Home page | Autoplay | Auto-advance to the next slide every 5 seconds; loop from last to first. |
| Home page | Manual controls | Provide previous/next buttons and direct slide selection (e.g., dots) that immediately navigates to the chosen slide. |
| Home page | Responsive layout | Adjust typography, spacing, and image cropping for desktop/tablet/mobile breakpoints; keep controls reachable and readable. |
| Home page | Lazy-loading | Lazy-load non-active slide images to reduce initial load; ensure currently visible slide image loads immediately. |
| Home page | Keyboard & ARIA accessibility | Support keyboard navigation for controls; expose carousel semantics with ARIA labels/roles; ensure focus visibility and screen-reader clarity. |

## 3. Core Process
**Visitor Flow (Home Page Slider)**
1. You open the home page and the hero slider loads.
2. If slide content is not available, the slider shows 5 fallback slides.
3. The slider advances automatically every 5 seconds.
4. You can use previous/next controls or slide indicators to navigate instantly.
5. You can navigate and operate controls via keyboard; assistive technologies can understand the carousel structure via ARIA.

```mermaid
graph TD
  A["Home Page"] --> B["Hero Slider Region"]
  B --> C["Autoplay (every 5s)"]
  B --> D["Manual Controls (Prev/Next, Dots)"]
  B --> E["Lazy-load Non-active Images"]
  B --> F["Keyboard + ARIA Accessibility