## 1. Product Overview
Add a localized top-menu navigation link labeled “Channels” / “Kanali”, and create a Netflix-style Channels listing page that displays links to all channels.
This improves discoverability and provides a modern, browse-first channel directory experience.

## 2. Core Features

### 2.1 Feature Module
The requirements consist of the following main pages:
1. **Home page**: top-menu localized “Channels/Kanali” link entry point.
2. **Channels page**: Netflix-style channel directory showing all channel links.
3. **Channel Watch page**: open a selected channel and provide navigation back to the directory.

### 2.2 Page Details
| Page Name | Module Name | Feature description |
|-----------|-------------|---------------------|
| Home page | Top menu navigation | Show a top-menu item whose label is localized: “Channels” (English) and “Kanali” (target locale). |
| Home page | Top menu navigation | Navigate to the Channels page when the menu item is clicked. |
| Home page | Localization binding | Update the menu label immediately when the user changes the active language (no refresh required). |
| Channels page | Page header | Display localized page title (matching the menu concept: “Channels/Kanali”) and a short helper subtitle like “Browse all channels”. |
| Channels page | Channel directory (Netflix-style rails) | Render channels as horizontal “rows/rails” of cards (Netflix-like). If channel categories exist, group by category; otherwise render a single “All Channels” rail. |
| Channels page | Channel card | Show each channel as a clickable card with logo/thumbnail and channel name (at least one must be visible). |
| Channels page | Channel link coverage | Ensure every channel in the directory data source appears on this page as a link (no hidden/partial lists). |
| Channels page | Interaction states | Provide hover/focus states for cards (scale/outline) to communicate clickability and improve UX. |
| Channels page | Empty/error state | If there are zero channels, show an empty state message; if channels fail to load, show a clear error message with a retry action (if applicable). |
| Channel Watch page | Player / open link | Open the selected channel from its link (the actual playback mechanism can be existing behavior: embedded player or external link). |
| Channel Watch page | Context + navigation | Show channel name and a clear “Back to Channels” action that returns to the Channels page. |

## 3. Core Process
- Localization flow: You change the site language → the top-menu updates to “Channels” or “Kanali” accordingly → the Channels page title also follows the active language.
- Browse flow: You click the localized top-menu item → you land on the Channels page → you browse the Netflix-style rails → you click a channel card.
- Watch flow: After clicking a channel card, you land on the Channel Watch page (or open the channel link per existing playback behavior) → you use “Back to Channels” to return to the directory.

```mermaid
graph TD
  A["Home Page"] --> B["Channels Page"]
  B --> C["Channel Watch Page"]
  C --> B
  A --> A