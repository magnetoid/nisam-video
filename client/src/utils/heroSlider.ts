export function clampIndex(idx: number, total: number): number {
  if (total <= 0) return 0;
  return ((idx % total) + total) % total;
}

export function resolveFallbackIndex(slideIndex: number, offset: number, fallbackCount: number): number {
  return clampIndex(slideIndex + offset, fallbackCount);
}
