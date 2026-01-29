import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SystemSettings } from "@shared/schema";

export function CustomCodeInjector() {
  const { data: settings } = useQuery<SystemSettings>({
    queryKey: ["/api/system/settings"],
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    meta: { silenceError: true }, // Silence error to prevent toast notifications
  });

  useEffect(() => {
    if (!settings) return;

    // SECURITY NOTE: innerHTML usage is intentional here.
    // This component injects admin-configured analytics/tracking scripts (GTM, etc.)
    // Access to modify these settings MUST be restricted to trusted administrators only.
    // DOMPurify is NOT used because it would strip <script> tags, breaking the intended functionality.

    // Inject head code
    if (settings.customHeadCode) {
      const headScript = document.createElement("div");
      headScript.innerHTML = settings.customHeadCode;
      
      // Move all elements from the div to head
      while (headScript.firstChild) {
        document.head.appendChild(headScript.firstChild);
      }
    }

    // Inject body start code
    if (settings.customBodyStartCode) {
      const bodyStartDiv = document.createElement("div");
      bodyStartDiv.innerHTML = settings.customBodyStartCode;
      
      // Insert at the beginning of body
      while (bodyStartDiv.firstChild) {
        document.body.insertBefore(bodyStartDiv.firstChild, document.body.firstChild);
      }
    }

    // Inject body end code
    if (settings.customBodyEndCode) {
      const bodyEndDiv = document.createElement("div");
      bodyEndDiv.innerHTML = settings.customBodyEndCode;
      
      // Append to end of body
      while (bodyEndDiv.firstChild) {
        document.body.appendChild(bodyEndDiv.firstChild);
      }
    }
  }, [settings]);

  // This component doesn't render anything visible
  return null;
}
