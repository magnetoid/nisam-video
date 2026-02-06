import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AnalyticsEvent } from "@shared/schema";

interface AnalyticsTrackerProps {
  children: React.ReactNode;
}

export function AnalyticsTracker({ children }: AnalyticsTrackerProps) {
  const { data: events } = useQuery<AnalyticsEvent[]>({
    queryKey: ["/api/admin/analytics/events"],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    meta: { silenceError: true }, // Silence error to prevent toast notifications
  });

  useEffect(() => {
    if (!events || events.length === 0) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element;
      
      events.forEach(analyticsEvent => {
        if (analyticsEvent.triggerType === "click" && analyticsEvent.selector) {
          const elements = document.querySelectorAll(analyticsEvent.selector);
          
          elements.forEach(element => {
            if (element.contains(target) || element === target) {
              // Push to dataLayer if GTM is available
              if (window.dataLayer) {
                window.dataLayer.push({
                  event: analyticsEvent.eventName,
                  ...(analyticsEvent.parameters && typeof analyticsEvent.parameters === "object"
                    ? analyticsEvent.parameters
                    : {}),
                  element: target.tagName,
                  text: target.textContent?.trim(),
                  timestamp: new Date().toISOString(),
                });
              }
              
              // Also try gtag if GA4 is available
              if (window.gtag) {
                window.gtag("event", analyticsEvent.eventName, {
                  ...(analyticsEvent.parameters && typeof analyticsEvent.parameters === "object"
                    ? analyticsEvent.parameters
                    : {}),
                  element: target.tagName,
                  text: target.textContent?.trim(),
                  timestamp: new Date().toISOString(),
                });
              }
            }
          });
        }
      });
    };

    const handleFormSubmit = (event: Event) => {
      const target = event.target as HTMLFormElement;
      
      events.forEach(analyticsEvent => {
        if (analyticsEvent.triggerType === "form_submit" && analyticsEvent.selector) {
          const elements = document.querySelectorAll(analyticsEvent.selector);
          
          elements.forEach(element => {
            if (element.contains(target) || element === target) {
              // Push to dataLayer if GTM is available
              if (window.dataLayer) {
                window.dataLayer.push({
                  event: analyticsEvent.eventName,
                  ...(analyticsEvent.parameters && typeof analyticsEvent.parameters === "object"
                    ? analyticsEvent.parameters
                    : {}),
                  formId: target.id,
                  formAction: target.action,
                  timestamp: new Date().toISOString(),
                });
              }
              
              // Also try gtag if GA4 is available
              if (window.gtag) {
                window.gtag("event", analyticsEvent.eventName, {
                  ...(analyticsEvent.parameters && typeof analyticsEvent.parameters === "object"
                    ? analyticsEvent.parameters
                    : {}),
                  formId: target.id,
                  formAction: target.action,
                  timestamp: new Date().toISOString(),
                });
              }
            }
          });
        }
      });
    };

    // Add event listeners
    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleFormSubmit, true);

    // Cleanup
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleFormSubmit, true);
    };
  }, [events]);

  // Track page views for page_view events
  useEffect(() => {
    if (!events || events.length === 0) return;

    events.forEach(analyticsEvent => {
      if (analyticsEvent.triggerType === "page_view") {
        // Push to dataLayer if GTM is available
        if (window.dataLayer) {
          window.dataLayer.push({
            event: analyticsEvent.eventName,
            ...(analyticsEvent.parameters && typeof analyticsEvent.parameters === "object"
              ? analyticsEvent.parameters
              : {}),
            page: window.location.pathname,
            title: document.title,
            timestamp: new Date().toISOString(),
          });
        }
        
        // Also try gtag if GA4 is available
        if (window.gtag) {
          window.gtag("event", analyticsEvent.eventName, {
            ...(analyticsEvent.parameters && typeof analyticsEvent.parameters === "object"
              ? analyticsEvent.parameters
              : {}),
            page: window.location.pathname,
            title: document.title,
            timestamp: new Date().toISOString(),
          });
        }
      }
    });
  }, [events]);

  return <>{children}</>;
}

// Extend the Window interface for TypeScript
declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}
