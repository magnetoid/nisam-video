export async function testOpenAIConnection(baseUrl: string, apiKey: string) {
  const url = (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  try {
    const res = await fetch(`${url}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[OpenAI Test] Failed with status ${res.status}:`, errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.error?.message || `API error: ${res.status}`);
      } catch (e) {
        if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
          throw e;
        }
        throw new Error(`API error: ${res.status} - ${errorText.substring(0, 100)}`);
      }
    }
    
    return true;
  } catch (error: any) {
    console.error("[OpenAI Test] Network or parsing error:", error);
    throw error;
  }
}

export async function generateOpenAICompletion(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const url = (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  
  try {
    const response = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OpenAI Generate] Error ${response.status}:`, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(`OpenAI API error: ${errorJson.error?.message || response.status}`);
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("OpenAI API error:")) throw e;
        throw new Error(`OpenAI API error: ${response.status} ${errorText.substring(0, 100)}`);
      }
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || "";
  } catch (error: any) {
    console.error("[OpenAI Generate] Request failed:", error);
    throw error;
  }
}

