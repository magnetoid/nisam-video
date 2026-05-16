// Single source of truth for per-platform UI metadata (label, icon, accent
// color). Keep in sync with server/shared/schema.ts SUPPORTED_PLATFORMS.

import { Youtube, Instagram } from "lucide-react";
import { SiTiktok } from "react-icons/si";
import type { ComponentType, SVGProps } from "react";

export type PlatformKey = "youtube" | "x" | "tiktok" | "instagram";

export const PLATFORM_ORDER: readonly PlatformKey[] = ["youtube", "x", "tiktok", "instagram"] as const;

type IconComponent = ComponentType<{ className?: string } & SVGProps<SVGSVGElement>>;

// Minimal inline SVG for X — lucide-react's `Twitter` is still the old bird
// glyph. This is the simplified "X" mark used in X's brand assets.
const XLogo: IconComponent = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    <path d="M17.53 2.477h3.243l-7.083 8.099 8.333 11.011h-6.527l-5.114-6.687-5.852 6.687H1.286l7.576-8.66L0.879 2.477h6.69l4.622 6.115 5.34-6.115ZM16.39 19.65h1.796L6.018 4.295H4.09L16.39 19.65Z" />
  </svg>
);

export interface PlatformConfig {
  key: PlatformKey;
  label: string;
  icon: IconComponent;
  /** Tremor color name for charts/decorations. */
  tremorColor: "red" | "sky" | "pink" | "fuchsia";
  /** Whether full management UI is wired up (false = "coming soon"). */
  managed: boolean;
}

export const PLATFORM_CONFIG: Record<PlatformKey, PlatformConfig> = {
  youtube: { key: "youtube", label: "YouTube", icon: Youtube, tremorColor: "red", managed: true },
  x: { key: "x", label: "X", icon: XLogo, tremorColor: "sky", managed: true },
  tiktok: { key: "tiktok", label: "TikTok", icon: SiTiktok as IconComponent, tremorColor: "pink", managed: true },
  instagram: { key: "instagram", label: "Instagram", icon: Instagram, tremorColor: "fuchsia", managed: false },
};

export function getPlatformLabel(key: string): string {
  return (PLATFORM_CONFIG[key as PlatformKey]?.label) ?? key;
}
