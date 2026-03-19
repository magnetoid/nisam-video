export async function clearCachesAndReload() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch {
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
  }

  const url = new URL(window.location.href);
  url.searchParams.set("_v", String(Date.now()));
  window.location.href = url.toString();
}

