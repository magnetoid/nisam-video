I will verify the server startup, migrate the KV store from Replit DB to Supabase (Postgres), and fully transition the AI system from OpenAI to Ollama.

### 1. Database Migration (Replit DB → Supabase/Postgres)
The current `REPLIT_DB_URL` is used for **Rate Limiting**, **View Buffering**, and **User History**. I will migrate this to a `kv_store` table in your existing Postgres database (Supabase), which provides better persistence and querying than Vercel Blob.

*   **Schema Update**: Add a `kv_store` table to `shared/schema.ts` with `key`, `value` (JSON), and `expires_at`.
*   **Adapter Implementation**: Rewrite `server/replit-db.ts` (renaming to `server/storage/kv.ts`) to use Drizzle ORM to interact with this new table.
*   **Service Update**: Ensure `server/kv-service.ts` uses this new Postgres-backed adapter.

### 2. AI Migration (OpenAI → Ollama)
I will remove all OpenAI dependencies and enforce Ollama as the sole AI provider.

*   **Remove Dependencies**: Uninstall `openai` and `@replit/database`.
*   **Refactor AI Service**:
    *   Rewrite `server/ai-service.ts` to remove OpenAI client initialization.
    *   Implement a lightweight Ollama client using `node-fetch` directly within the service.
    *   Ensure all generation functions (`categorizeVideo`, `generateVideoSummary`, etc.) use the Ollama endpoint.
*   **Update Routes**:
    *   Fix `server/routes/tags.ts` and `server/routes/admin.ts` to stop using the OpenAI SDK and use the shared `ai-service`.
    *   Simplify `server/routes/ai-settings.ts` to only manage Ollama configuration.

### 3. Verification
*   Verify the server starts without `OPENAI_API_KEY` or `REPLIT_DB_URL` warnings.
*   Test that rate limiting and view counting continue to work using the new database table.
*   Confirm AI endpoints attempt to connect to the local Ollama instance.