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

export async function fetchRemoteOllamaModels(url: string, apiKey?: string): Promise<OllamaModel[]> {
  try {
    // Ensure URL has protocol
    if (!url.startsWith("http")) {
      url = `http://${url}`;
    }
    
    // Remove trailing slash if present
    const baseUrl = url.replace(/\/$/, "");

    const tagsUrl = `${baseUrl}/api/tags`;
    
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(tagsUrl, { headers });
    
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

export async function testOllamaConnection(url: string, apiKey?: string): Promise<boolean> {
  try {
    // Ensure URL has protocol
    if (!url.startsWith("http")) {
      url = `http://${url}`;
    }
    
    // Remove trailing slash if present
    const baseUrl = url.replace(/\/$/, "");
    
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Try hitting the version endpoint or tags endpoint
    // Ollama root usually returns "Ollama is running"
    const response = await fetch(baseUrl, { headers });
    
    if (response.ok) {
      return true;
    }
    
    // Fallback to trying /api/tags if root fails
    const tagsResponse = await fetch(`${baseUrl}/api/tags`, { headers });
    return tagsResponse.ok;
  } catch (error: any) {
    console.error("[OllamaService] Connection test error:", error);
    if (error.code === 'ECONNREFUSED') {
        throw new Error(`Connection refused. Ensure Ollama is publicly accessible at ${url}.`);
    }
    return false;
  }
}

export async function generateOllamaCompletion(
  url: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  apiKey?: string
): Promise<string> {
  // Ensure URL has protocol
  if (!url.startsWith("http")) {
    url = `http://${url}`;
  }
  
  // Remove trailing slash if present
  const baseUrl = url.replace(/\/$/, "");
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model,
      system: systemPrompt,
      prompt: userPrompt,
      stream: false,
      format: "json", // Force JSON output
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama API error: ${response.status} ${errorText}`);
  }

  const data = await response.json() as any;
  return data.response || "";
}
