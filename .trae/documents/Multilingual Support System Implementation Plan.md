# Implementation Plan: Comprehensive Multilingual Support System

I have analyzed the codebase and found that while the database schema (`shared/schema.ts`) and database storage layer (`server/storage.ts`) have been updated to support normalized multilingual data (separating base entities from translations), the API routes (`server/routes.ts`), in-memory storage, and frontend components are still operating on the old denormalized structure. This plan addresses these discrepancies to fully implement the requested system.

## 1. Backend & Storage Standardization
### Fix Storage Inconsistencies
- Update `MemStorage` in `server/storage.ts` to implement the `IStorage` interface correctly, matching the normalized `createCategory` and `createTag` signatures used by `DatabaseStorage`.
- Ensure `MemStorage` supports the "Base + Translations" pattern to prevent type errors and runtime failures during development/testing.

### Update API Routes (`server/routes.ts`)
Refactor endpoints to support localized data handling:
- **Categories**:
  - `GET /api/categories`: Add `lang` query parameter support. Call `storage.getAllLocalizedCategories(lang)`.
  - `POST /api/categories`: Update to accept `translations` array or default to creating an English translation from the provided `name`/`description`.
  - `PUT /api/categories/:id`: Update to handle translation updates (e.g., `PUT /api/categories/:id/:lang` or body-based language selection).
- **Tags**:
  - `GET /api/tags`: Implement missing endpoint to fetch localized tags.
  - `POST /api/tags`: Implement endpoint for manual tag creation with translations.
- **Videos**:
  - Update `GET /api/videos` and `/api/videos/:id` to pass the `lang` parameter to storage methods for hydrating localized relations.

## 2. Admin Interface Enhancements
### Admin Categories (`client/src/pages/AdminCategories.tsx`)
- Refactor the **Create/Edit Dialog** to support multiple languages.
- Implement a **Tabbed Interface** (using `Tabs` component) within the form:
  - **English (Default)**: Name, Description, Slug.
  - **Serbian (sr-Latn)**: Name, Description, Slug.
- Fetch and display existing translations when editing.

### Admin Tags (`client/src/pages/AdminTags.tsx`)
- Create/Update the Admin Tags interface (if exists, or create `AdminTags.tsx` based on `AdminCategories.tsx`) to support multilingual editing similar to categories.

## 3. Frontend Public Interface
### Localization Integration
- Update `client/src/lib/api.ts` (or equivalent query functions) to automatically include the current language code (from `i18next`) in API requests.
- **Categories Page (`Categories.tsx`)**: Update to display localized names and descriptions.
- **Tags Page (`Tags.tsx`)**: Update to display localized tag names.
- **Video Detail Page (`VideoPage.tsx`)**: Ensure categories and tags displayed on the video page match the user's selected language.

## 4. Validation & Synchronization
- **Zod Schemas**: Enforce validation using existing `insertCategoryTranslationSchema` and `insertTagTranslationSchema` in API routes.
- **AI Categorization**: Update `/api/videos/:id/categorize` to explicitly create English translations for AI-generated categories and tags, ensuring backward compatibility.

## 5. Verification
- **Test Plan**:
  1. Create a category with English and Serbian translations via Admin UI.
  2. Verify correct display in Admin list.
  3. Switch public site language to Serbian and verify the category name changes.
  4. Verify fallback to English for missing translations.
