I will implement the custom Ollama server integration as follows:

### 1. Database Schema Updates (`shared/schema.ts`)
- **Add `ai_settings` table**: To store the active provider ('openai' or 'ollama'), API keys, and base URLs.
- **Add `ai_models` table**: To cache available Ollama models with fields for `name`, `size`, `digest`, `family`, and `is_active` status.

### 2. Backend Implementation
- **Create `server/services/ollama.ts`**:
  - Implement `fetchRemoteOllamaModels(url)` to retrieve models from `https://ollama.fpp.co.uk/api/tags`.
  - Implement `testOllamaConnection(url)` to verify connectivity.
- **Refactor `server/ai-service.ts`**:
  - Update the service to dynamically initialize the AI client (OpenAI or Ollama) based on database settings.
  - Implement a switch mechanism to route generation requests (`categorizeVideo`, `generateSummary`) to the active provider.
- **Create `server/routes/ai-settings.ts`**:
  - `GET/PATCH /api/ai/config`: Manage global AI settings.
  - `POST /api/ai/ollama/sync`: Fetch and update the local cache of Ollama models.
  - `GET /api/ai/models`: List available models.
  - `POST /api/ai/test`: Test the connection to the configured provider.
- **Update `server/routes.ts`**: Register the new AI settings routes.

### 3. Frontend Implementation
- **Create `client/src/pages/AdminAISettings.tsx`**:
  - **Settings Panel**: Toggle between OpenAI and Ollama, configure API keys and URLs.
  - **Model Management**: A list view of Ollama models with options to enable/disable specific models and a "Sync Models" button.
  - **Connectivity Test**: Real-time status indicator for the selected provider.
- **Update `client/src/App.tsx`**: Add the route for the new admin page.
- **Update `client/src/components/AdminSidebar.tsx`**: Add a new "AI Settings" navigation item.

### 4. Verification
- Verify that models are correctly fetched from the external Ollama server.
- specific unit tests for the integration.
- Ensure the AI service correctly switches providers and uses the selected model for generation tasks.