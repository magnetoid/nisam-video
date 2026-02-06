# Comprehensive Code Refactoring Plan

This plan addresses the identified technical debt, focusing on splitting "God Objects," removing code duplication, improving type safety, and enhancing maintainability.

## Phase 1: Server Architecture & Core Storage (High Impact)
**Objective**: Break down the monolithic `storage.ts` and fix route duplication.

1.  **Modularize Storage Layer**:
    *   Create `server/storage/` directory.
    *   Extract interfaces to `server/storage/types.ts`.
    *   Move `DatabaseStorage` class to `server/storage/database.ts`.
    *   Move `MemStorage` class to `server/storage/memory.ts`.
    *   Create `server/storage/index.ts` to export the singleton instance, maintaining backward compatibility.
2.  **Clean Up Route Handling**:
    *   Audit `server/routes.ts` vs `server/routes/*.ts`.
    *   Remove duplicate route implementations from `server/routes.ts` (e.g., video routes that are already in `server/routes/videos.ts`).
    *   Ensure `server/routes.ts` acts strictly as a router hub, mounting sub-routers instead of defining inline logic.

## Phase 2: Code Quality & Complexity (Medium Impact)
**Objective**: Improve readability and type safety in the newly modularized server code.

1.  **Refactor Complex Methods**:
    *   Extract `hydrateVideosWithRelations` logic into a dedicated helper or service method to reduce complexity.
    *   Break down `getActiveHeroVideos` into smaller, named strategy functions (e.g., `fetchAdminSelectedHeroes`, `fetchAnalyticsHeroes`, `fetchTrendingFallback`).
2.  **Type Safety Improvements**:
    *   Identify usages of `any` in `storage` modules (specifically `cachedSettings` and `sigiData`).
    *   Define proper TypeScript interfaces for these structures.
    *   Replace `any` casts with proper type assertions or validation (using Zod where appropriate).

## Phase 3: Client-Side Reusability (Medium Impact)
**Objective**: Reduce code duplication in the Admin UI.

1.  **Extract Admin Components**:
    *   Create a generic `AdminDataTable` component in `client/src/components/admin/`.
    *   This component will handle common features: table layout, loading states, empty states, and pagination.
2.  **Refactor Admin Pages**:
    *   Update `AdminCategories.tsx` to use `AdminDataTable`.
    *   Update `AdminTags.tsx` to use `AdminDataTable`.

## Phase 4: Documentation & Verification
**Objective**: Ensure code is maintainable and works as expected.

1.  **Documentation**:
    *   Add JSDoc comments to key methods in the new `Storage` interface.
    *   Update `README.md` to reflect the new server structure.
2.  **Verification**:
    *   Run existing tests to ensure no regressions.
    *   Manually verify key flows: Video playback, Hero Slider fallback, and Admin CRUD operations.
