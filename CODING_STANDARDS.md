# Nisam Video - Project Coding Standards & Guidelines

This document serves as the centralized repository for all development standards, UI component usage rules, and architectural guidelines for the Nisam Video platform. These rules are enforced via automated CI/CD checks (ESLint, Prettier, TypeScript compiler) and mandatory peer code reviews.

---

## 1. UI Component Usage (Shadcn UI & Tremor)

We utilize a dual-library system for our UI components to separate interactive elements from data visualization.

### Shadcn UI Conventions
*   **Primary Usage:** Use Shadcn UI (`@/components/ui/`) for *all* standard interactive elements, including:
    *   Forms (Inputs, Selects, Switches, Textareas)
    *   Dialogs & Modals
    *   Buttons
    *   Dropdown Menus
    *   Navigation & Tabs
*   **Composition:** Prefer composition over configuration. Assemble complex UIs by composing smaller Shadcn primitives.
*   **Styling:** Use Tailwind CSS utility classes. Avoid inline styles (`style={{...}}`) entirely.

### Tremor Component Patterns
*   **Primary Usage:** Tremor (`@tremor/react`) is strictly reserved for **Data Visualization** and **Dashboard Layouts**.
    *   Use Tremor `Card`, `Grid`, and `Flex` specifically for analytics panels.
    *   Use Tremor `Metric`, `Text`, `Subtitle`, and `Title` for dashboard typography to ensure consistent metric alignment.
    *   Use Tremor charts (`AreaChart`, `BarChart`, `DonutChart`) for all graph representations.
*   **Strict Boundary:** Do *not* use Tremor inputs (like Tremor's `Select` or `Button`) where Shadcn equivalents exist. Keep data presentation (Tremor) decoupled from data mutation (Shadcn).
*   **Dark Mode:** Ensure you use `dark-tremor` overrides or rely on the inherited Tremor dark mode classes seamlessly.

---

## 2. General TypeScript & React Standards

### Simplicity First
*   Write the minimum code necessary to solve the problem. Do not build speculative "future-proof" abstractions.
*   If a function or component exceeds 150 lines, evaluate if it can be simplified or broken down.
*   **No Unused Code:** If your changes render previous variables, imports, or functions obsolete, you must delete them. Do not leave orphaned code.

### Surgical Changes
*   When editing existing files, only touch what is necessary for your specific task.
*   Do not refactor adjacent, working code simply because you prefer a different style. Match the surrounding file's style perfectly.

### Strict Typing
*   **Zero `any`:** The use of `any` is strictly prohibited in new code. Define precise interfaces or Zod schemas.
*   The project must pass `npx tsc --noEmit` without any errors before every commit.

---

## 3. Backend Architecture & Database

### Drizzle ORM
*   Use Drizzle ORM (`drizzle-orm`) for all database queries.
*   **Anti-Pattern Alert:** Never use `for` loops to execute sequential database queries (N+1 problem). Always use SQL bulk operations or `Promise.all` with chunking for large datasets.

### State Management & API
*   Use `@tanstack/react-query` for all client-side data fetching, caching, and state synchronization.
*   All API mutations must return standardized JSON responses and be strictly validated using `zod` schemas on the Express server.
*   All Express routes must be wrapped in appropriate error boundary `try/catch` blocks to prevent server crashes.

---

## 4. Enforcement Mechanisms

*   **Pre-commit Hook:** Husky is configured to run `eslint` and `prettier` automatically.
*   **TypeScript Check:** You must verify `npx tsc --noEmit` succeeds locally before pushing.
*   **Code Review:** Reviewers are instructed to specifically check for proper Shadcn/Tremor separation and the absence of orphaned code.