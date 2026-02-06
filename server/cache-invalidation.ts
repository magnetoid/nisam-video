import { cache } from "./cache.js";

export function invalidateVideoContentCaches() {
  cache.invalidatePattern("^http:/api/videos");
  cache.invalidatePattern("^http:/api/categories");
  cache.invalidatePattern("^http:/api/tags");
  cache.invalidatePattern("^http:/api/channels");
  cache.invalidatePattern("^http:/api/playlists");
  cache.invalidatePattern("^http:/api/system/settings");

  cache.invalidatePattern("^videos:");
  cache.invalidatePattern("^home:hero:");
  cache.invalidatePattern("^hero:");
}

export function invalidateChannelCaches() {
  cache.invalidatePattern("^http:/api/channels");
  cache.invalidatePattern("^channels:");
}

