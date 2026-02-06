## Resolution Plan for Server-Side 500 Errors

### Overview

Target: Eliminate `FUNCTION_INVOCATION_FAILED` on Vercel by optimizing serverless init, enhancing error handling, and verifying DB robustness. Builds on prior fixes (pooling, ESM). No core logic changes.

### Files to Edit

* `server/index.ts`: Add phased logging, conditional cache warm.

* `api/index.ts`: Granular try/catch in init.

* `server/db.ts`: Add acquire timeout, readiness check.

* `server/storage/database.ts`: Wrap queries in try/catch with fallbacks.

* Routes (e.g., `server/routes/categories.ts`): Ensure await + catch.

* Client (optional): `client/src/lib/queryClient.ts` for retries.

### Step-by-Step Changes

1. **server/index.ts**:

   * Insert timing logs: `const phaseStart = Date.now(); ... log(\`Phase complete: ${Date.now() - phaseStart}ms\`);\`

   * Cache warm: `if (process.env.VERCEL !== '1') { Promise.all([...]).catch(e => log('Warm failed', e)); }`

   * Move global error handler to top (before routes).

2. **api/index.ts**:

   * Wrap `startServer()` phases: `try { const server = await registerRoutes(app); } catch(e) { log('Routes init failed', e); res.status(503).json({message: 'Service Unavailable'}); }`

   * Add: `if (!isDbReady()) { return res.status(503).json({message: 'DB not ready'}); }` (import from db.ts).

3. **server/db.ts**:

   * Pool config: Add `acquireTimeoutMillis: 5000,`.

   * Export `export function isDbReady() { return !!pool && !!db; }`.

4. **server/storage/database.ts**:

   * In methods (e.g., `getAllLocalizedCategories`): `try { const result = await db.select()...; return result; } catch(e) { log('Query failed: ' + method, e); return []; }`

   * `getCacheSettings()`: Prefix with `if (!isDbReady()) return defaults;`.

5. **ESM Audit**:

   * Run grep: `pattern: import .* from .* without .js`, fix in routes/storage.

6. **Client Resilience (Optional)**:

   * `queryClient.ts`: `new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 1000 } } })`.

### Verification

* **Local Tests**: `npm run build && NODE_ENV=production node dist/index.js`; curl APIs → 200, init <5s.

* **Unit/Integration**: Add Vitest for storage mocks: `test('getCategories falls back on error', () => { ... expect(result).toEqual([]); });`.

* **Deploy**: `vercel --prod`; Monitor Vercel logs for 0 500s on /api/categories etc.

* **Monitoring**: Add console.error in catches; check for incident recurrence.

### Expected Outcome

* Cold starts <5s; APIs return data or graceful 503.

* Logs: Pinpoint failures (e.g., "DB acquire timeout").

* Uptime: 100% for public endpoints post-deploy.

