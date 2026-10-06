import {
  addDays,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export const DEFAULT_TZ = "America/Detroit";

export function nowUtc(): Date {
  return new Date();
}

export function formatTime(date: Date, tz = DEFAULT_TZ): string {
  return formatInTimeZone(date, tz, "h:mm a");
}

export function formatDate(date: Date, tz = DEFAULT_TZ): string {
  return formatInTimeZone(date, tz, "EEE, MMM d, yyyy");
}

export function formatDateTime(date: Date, tz = DEFAULT_TZ): string {
  return formatInTimeZone(date, tz, "MMM d, yyyy h:mm a");
}

export function formatShortDate(date: Date, tz = DEFAULT_TZ): string {
  return formatInTimeZone(date, tz, "yyyy-MM-dd");
}

/** Elapsed ms between two real timestamps (DST-safe). */
export function elapsedMs(start: Date, end: Date): number {
  return Math.max(0, end.getTime() - start.getTime());
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

export function formatDurationLong(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

export function toDecimalHours(ms: number): number {
  return Math.round((ms / 3_600_000) * 100) / 100;
}

export function zonedDayBounds(date: Date, tz = DEFAULT_TZ): { start: Date; end: Date } {
  const zoned = toZonedTime(date, tz);
  const startLocal = startOfDay(zoned);
  const endLocal = endOfDay(zoned);
  return {
    start: fromZonedTime(startLocal, tz),
    end: fromZonedTime(endLocal, tz),
  };
}

export type HistoryFilter = "this_week" | "last_week" | "this_month" | "custom";

export function historyRange(
  filter: HistoryFilter,
  tz = DEFAULT_TZ,
  customStart?: string,
  customEnd?: string,
): { start: Date; end: Date; label: string } {
  const now = toZonedTime(new Date(), tz);

  if (filter === "custom" && customStart && customEnd) {
    const start = fromZonedTime(startOfDay(new Date(`${customStart}T12:00:00`)), tz);
    const end = fromZonedTime(endOfDay(new Date(`${customEnd}T12:00:00`)), tz);
    return {
      start,
      end,
      label: `${customStart} – ${customEnd}`,
    };
  }

  if (filter === "this_month") {
    const start = fromZonedTime(startOfMonth(now), tz);
    const end = fromZonedTime(endOfMonth(now), tz);
    return { start, end, label: format(now, "MMMM yyyy") };
  }

  if (filter === "last_week") {
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const lastWeekStart = addDays(thisWeekStart, -7);
    const lastWeekEnd = addDays(thisWeekStart, -1);
    return {
      start: fromZonedTime(startOfDay(lastWeekStart), tz),
      end: fromZonedTime(endOfDay(lastWeekEnd), tz),
      label: "Last week",
    };
  }

  // this_week (default) — Monday start
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  return {
    start: fromZonedTime(startOfDay(weekStart), tz),
    end: fromZonedTime(endOfDay(now), tz),
    label: "This week",
  };
}

/** Warning threshold: 14 hours without clock-out. */
export const LONG_SHIFT_MS = 14 * 60 * 60 * 1000;
