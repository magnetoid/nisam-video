import fetch from "node-fetch";

interface OllamaModelDetails {
  parent_model: string;
  format: string;
  family: string;
  families: string[];
  parameter_size: string;
  quantization_level: string;
}

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: OllamaModelDetails;
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

export async function fetchRemoteOllamaModels(url: string): Promise<OllamaModel[]> {
  try {
    // Ensure URL has protocol
    if (!url.startsWith("http")) {
      url = `http://${url}`;
    }
    
    // Remove trailing slash if present
    const baseUrl = url.replace(/\/$/, "");

    // Fast-fail for localhost on Vercel
    if (process.env.VERCEL === '1' && (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'))) {
       throw new Error("Cannot connect to localhost Ollama on Vercel. Please configure a remote Ollama URL (e.g., via ngrok) or use OpenAI.");
    }

    const tagsUrl = `${baseUrl}/api/tags`;
    
    const response = await fetch(tagsUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as OllamaTagsResponse;
    return data.models || [];
  } catch (error: any) {
    console.error("[OllamaService] Fetch models error:", error);
    if (error.code === 'ECONNREFUSED') {
       throw new Error(`Connection refused to ${url}. Ensure your Ollama server is running and accessible from the public internet (check firewalls/port forwarding).`);
    }
    throw error;
  }
}

export async function testOllamaConnection(url: string): Promise<boolean> {
  try {
    // Ensure URL has protocol
    if (!url.startsWith("http")) {
      url = `http://${url}`;
    }
    
    // Remove trailing slash if present
    const baseUrl = url.replace(/\/$/, "");

    // Fast-fail for localhost on Vercel
    if (process.env.VERCEL === '1' && (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'))) {
       throw new Error("Cannot connect to localhost Ollama on Vercel. Please configure a remote Ollama URL (e.g., via ngrok) or use OpenAI.");
    }
    
    // Try hitting the version endpoint or tags endpoint
    // Ollama root usually returns "Ollama is running"
    const response = await fetch(baseUrl);
    
    if (response.ok) {
      return true;
    }
    
    // Fallback to trying /api/tags if root fails
    const tagsResponse = await fetch(`${baseUrl}/api/tags`);
    return tagsResponse.ok;
  } catch (error: any) {
    console.error("[OllamaService] Connection test error:", error);
    if (error.code === 'ECONNREFUSED') {
        throw new Error(`Connection refused. Ensure Ollama is publicly accessible at ${url}.`);
    }
    // Propagate Vercel error for UI visibility
    if (error.message.includes("Vercel")) {
        throw error;
    }
    return false;
  }
}
