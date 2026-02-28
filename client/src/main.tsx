import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPerformanceMonitoring } from "./lib/performanceMonitoring";

console.log("Client app starting...");

// Global error handler for chunk loading errors (common after deployments)
window.addEventListener("error", (event) => {
  const message = event.message || "";
  const isChunkError = 
    /Loading chunk [\d]+ failed/.test(message) || 
    /Failed to fetch dynamically imported module/.test(message) ||
    /Importing a module script failed/.test(message);
  
  if (isChunkError) {
    event.preventDefault();
    console.warn("Chunk load error detected. Reloading page to fetch latest version...");
    
    // Prevent infinite reload loops
    const lastReload = sessionStorage.getItem("chunk_reload_time");
    const now = Date.now();
    
    if (!lastReload || now - parseInt(lastReload) > 10000) {
      sessionStorage.setItem("chunk_reload_time", String(now));
      window.location.reload();
    } else {
      console.error("Reload loop detected. Not reloading again.");
    }
  }
});

// Only register service worker in production
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => console.log("SW registered:", registration))
      .catch((error) => console.log("SW registration failed:", error));
  });
} else if ("serviceWorker" in navigator) {
  // Unregister service worker in development to avoid caching issues
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
      console.log("SW unregistered in dev mode");
    }
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("Root element not found!");
  document.body.innerHTML = "<h1>Root element not found!</h1>";
} else {
  try {
    createRoot(rootElement).render(<App />);
    console.log("React app rendered");
  } catch (error) {
    console.error("Failed to render React app:", error);
    rootElement.innerHTML = `
      <div style="padding: 20px; color: red;">
        <h1>Application Error</h1>
        <pre>${error instanceof Error ? error.message : String(error)}</pre>
      </div>
    `;
  }
}

try {
  initPerformanceMonitoring();
} catch (e) {
  console.error("Performance monitoring failed:", e);
}
