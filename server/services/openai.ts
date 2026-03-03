export async function testOpenAIConnection(baseUrl: string, apiKey: string) {
  const url = (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const res = await fetch(`${url}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  return res.ok;
}

