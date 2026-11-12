const TIME_ZONE = "Asia/Kolkata";

/**
 * Today's date in India as YYYY-MM-DD. Call only after request data has
 * been read (Cache Components forbids reading the clock while prerendering).
 */
export function todayIst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Formats a minute count as "7h 45m". */
export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}

/** Formats a timestamp as a time of day in IST, e.g. "9:32 am". */
export function formatTime(timestamp: string | null | undefined): string {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}
