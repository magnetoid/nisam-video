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

    const hostname = window.location.hostname;
    const shouldInjectThirdParty =
      hostname === "nisam.video" || hostname.endsWith(".nisam.video");
    
    const checkAndInjectScripts = () => {
      const isAdminRoute = window.location.pathname.startsWith("/admin");
      const shouldInjectOnThisRoute = !isAdminRoute;

      // Clear any existing GTM/GA4 scripts first
      const existingScripts = document.querySelectorAll('script[data-injected="analytics"], noscript[data-injected="analytics"]');
      existingScripts.forEach(script => script.remove());

      // SECURITY NOTE: innerHTML usage is intentional here.
      // This component injects admin-configured analytics/tracking scripts (GTM, etc.)
      // Access to modify these settings MUST be restricted to trusted administrators only.
      // DOMPurify is NOT used because it would strip <script> tags, breaking the intended functionality.

      // Inject GTM if configured
      if (shouldInjectThirdParty && shouldInjectOnThisRoute && settings.gtmId) {
        // GTM Head Script
        const script = document.createElement("script");
        script.setAttribute("data-injected", "analytics");
        script.text = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${settings.gtmId}');`;
        document.head.appendChild(script);

        // GTM Body Noscript
        const noscript = document.createElement("noscript");
        noscript.setAttribute("data-injected", "analytics");
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.googletagmanager.com/ns.html?id=${settings.gtmId}`;
        iframe.height = "0";
        iframe.width = "0";
        iframe.style.display = "none";
        iframe.style.visibility = "hidden";
        noscript.appendChild(iframe);
        document.body.insertBefore(noscript, document.body.firstChild);
      }

      // Inject GA4 if configured
      if (shouldInjectThirdParty && shouldInjectOnThisRoute && settings.ga4Id) {
        const script = document.createElement("script");
        script.setAttribute("data-injected", "analytics");
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${settings.ga4Id}`;
        document.head.appendChild(script);

        const configScript = document.createElement("script");
        configScript.setAttribute("data-injected", "analytics");
        configScript.text = `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${settings.ga4Id}');
        `;
        document.head.appendChild(configScript);
      }

      // Inject head code
      if (shouldInjectThirdParty && shouldInjectOnThisRoute && settings.customHeadCode) {
        const headScript = document.createElement("div");
        headScript.innerHTML = settings.customHeadCode;
        
        // Move all elements from the div to head
        while (headScript.firstChild) {
          const element = headScript.firstChild;
          if (element.nodeType === Node.ELEMENT_NODE && (element as Element).tagName === 'SCRIPT') {
            (element as Element).setAttribute("data-injected", "analytics");
          }
          document.head.appendChild(element);
        }
      }

      // Inject body start code
      if (shouldInjectThirdParty && shouldInjectOnThisRoute && settings.customBodyStartCode) {
        const bodyStartDiv = document.createElement("div");
        bodyStartDiv.innerHTML = settings.customBodyStartCode;
        
        // Insert at the beginning of body
        while (bodyStartDiv.firstChild) {
          const element = bodyStartDiv.firstChild;
          if (element.nodeType === Node.ELEMENT_NODE && (element as Element).tagName === 'SCRIPT') {
            (element as Element).setAttribute("data-injected", "analytics");
          }
          document.body.insertBefore(element, document.body.firstChild);
        }
      }

      // Inject body end code
      if (shouldInjectThirdParty && shouldInjectOnThisRoute && settings.customBodyEndCode) {
        const bodyEndDiv = document.createElement("div");
        bodyEndDiv.innerHTML = settings.customBodyEndCode;
        
        // Append to end of body
        while (bodyEndDiv.firstChild) {
          const element = bodyEndDiv.firstChild;
          if (element.nodeType === Node.ELEMENT_NODE && (element as Element).tagName === 'SCRIPT') {
            (element as Element).setAttribute("data-injected", "analytics");
          }
          document.body.appendChild(element);
        }
      }
    };

    // Initial injection
    checkAndInjectScripts();

    // Listen for route changes (for SPA navigation)
    const handleRouteChange = () => {
      checkAndInjectScripts();
    };

    // Listen for popstate events (browser navigation)
    window.addEventListener('popstate', handleRouteChange);
    
    // Listen for pushstate/replacestate events (SPA navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(handleRouteChange, 0);
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(handleRouteChange, 0);
    };

    return () => {
      // Cleanup
      window.removeEventListener('popstate', handleRouteChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      
      // Remove injected scripts
      const existingScripts = document.querySelectorAll('script[data-injected="analytics"], noscript[data-injected="analytics"]');
      existingScripts.forEach(script => script.remove());
    };
  }, [settings]);

  // This component doesn't render anything visible
  return null;
}
