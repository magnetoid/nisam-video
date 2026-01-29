import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

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

createRoot(document.getElementById("root")!).render(<App />);
