export function formatViewCount(count: string | number | null | undefined): string {
  if (!count) return "0 views";
  
  const num = typeof count === "string" ? parseInt(count.replace(/[^0-9]/g, ""), 10) : count;
  
  if (isNaN(num)) return String(count);

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(num) + " views";
}

export function formatTimeAgo(date: string | Date | null | undefined): string {
  if (!date) return "";
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (diffInSeconds < 60) return rtf.format(-diffInSeconds, "second");
  if (diffInSeconds < 3600) return rtf.format(-Math.floor(diffInSeconds / 60), "minute");
  if (diffInSeconds < 86400) return rtf.format(-Math.floor(diffInSeconds / 3600), "hour");
  if (diffInSeconds < 604800) return rtf.format(-Math.floor(diffInSeconds / 86400), "day");
  if (diffInSeconds < 2592000) return rtf.format(-Math.floor(diffInSeconds / 604800), "week");
  if (diffInSeconds < 31536000) return rtf.format(-Math.floor(diffInSeconds / 2592000), "month");
  
  return rtf.format(-Math.floor(diffInSeconds / 31536000), "year");
}
