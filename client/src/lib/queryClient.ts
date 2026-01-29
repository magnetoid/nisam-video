import { QueryClient, QueryFunction, QueryCache, MutationCache } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const contentType = res.headers.get("content-type") || "";
    const bodyText = (await res.text()) || res.statusText;
    const snippet = bodyText.length > 500 ? `${bodyText.slice(0, 500)}…` : bodyText;
    const detail = contentType ? `${contentType} ${snippet}` : snippet;
    throw new Error(`${res.status}: ${detail}`);
  }
}

async function safeJson<T>(res: Response, url: string): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    const snippet = text.length > 500 ? `${text.slice(0, 500)}…` : text;
    throw new Error(
      `Expected JSON but received ${contentType || "unknown content-type"} from ${url}. Body starts with: ${snippet}`,
    );
  }
  return (await res.json()) as T;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn = <T,>({
  on401: unauthorizedBehavior,
}: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null as unknown as T;
    }

    await throwIfResNotOk(res);
    return await safeJson<T>(res, url);
  };

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Don't show toast for background refetch errors or if explicitly silenced
      if (query.meta?.silenceError) return;
      
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      const stack = error instanceof Error ? error.stack : undefined;
      
      // Try to parse JSON error message if it looks like one
      let displayMessage = errorMessage;
      try {
          // If error message is like "500: {...}", extract the JSON part
          const match = errorMessage.match(/^\d+:\s*({.*})$/);
          if (match) {
             const json = JSON.parse(match[1]);
             if (json.error) displayMessage = json.error;
             if (json.message) displayMessage = json.message;
          }
      } catch (e) {
          // Keep original message
      }

      toast({
        variant: "destructive",
        title: "Request Failed",
        description: displayMessage,
        details: stack || String(error)
      });
    }
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
       if (mutation.meta?.silenceError) return;

       const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
       const stack = error instanceof Error ? error.stack : undefined;
       
       let displayMessage = errorMessage;
       try {
           const match = errorMessage.match(/^\d+:\s*({.*})$/);
           if (match) {
              const json = JSON.parse(match[1]);
              if (json.error) displayMessage = json.error;
              if (json.message) displayMessage = json.message;
           }
       } catch (e) {
           // Keep original message
       }

       toast({
         variant: "destructive",
         title: "Action Failed",
         description: displayMessage,
         details: stack || String(error)
       });
    }
  }),
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 10 * 60 * 1000, // 10 minutes - increased for better performance
      gcTime: 30 * 60 * 1000, // 30 minutes - keep in memory longer for faster navigation
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Prefetch home page data on app load for faster initial render
export function prefetchHomeData() {
  queryClient.prefetchQuery({
    queryKey: ["/api/videos/carousels"],
    staleTime: 10 * 60 * 1000,
  });
  queryClient.prefetchQuery({
    queryKey: ["/api/categories"],
    staleTime: 30 * 60 * 1000, // Categories rarely change
  });
}
