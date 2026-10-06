import { elapsedMs } from "./time";

export type EventLike = {
  id: string;
  type: string;
  occurredAt: Date;
  locationId: string | null;
  location?: { id: string; name: string } | null;
  noteText?: string | null;
  noteCategory?: string | null;
};

export type Segment = {
  locationId: string | null;
  locationName: string;
  startAt: Date;
  endAt: Date;
  durationMs: number;
};

/**
 * Derive location segments from consecutive LOCATION_CHANGE events.
 * Time before first location (or after explicit clear) is Unassigned.
 */
export function deriveSegments(
  clockInAt: Date,
  clockOutAt: Date | null,
  events: EventLike[],
  asOf: Date = new Date(),
): Segment[] {
  const end = clockOutAt ?? asOf;
  const locationChanges = events
    .filter((e) => e.type === "LOCATION_CHANGE")
    .slice()
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  const points: { at: Date; locationId: string | null; locationName: string }[] = [
    { at: clockInAt, locationId: null, locationName: "Unassigned" },
  ];

  for (const ev of locationChanges) {
    points.push({
      at: ev.occurredAt,
      locationId: ev.locationId,
      locationName: ev.location?.name ?? (ev.locationId ? "Unknown" : "Unassigned"),
    });
  }

  const segments: Segment[] = [];
  for (let i = 0; i < points.length; i++) {
    const startAt = points[i].at;
    const endAt = i + 1 < points.length ? points[i + 1].at : end;
    if (endAt.getTime() <= startAt.getTime()) continue;
    segments.push({
      locationId: points[i].locationId,
      locationName: points[i].locationName,
      startAt,
      endAt,
      durationMs: elapsedMs(startAt, endAt),
    });
  }

  return segments;
}

export function totalsByLocation(segments: Segment[]): {
  locationId: string | null;
  locationName: string;
  durationMs: number;
}[] {
  const map = new Map<string, { locationId: string | null; locationName: string; durationMs: number }>();
  for (const s of segments) {
    const key = s.locationId ?? "__unassigned__";
    const existing = map.get(key);
    if (existing) {
      existing.durationMs += s.durationMs;
    } else {
      map.set(key, {
        locationId: s.locationId,
        locationName: s.locationName,
        durationMs: s.durationMs,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.durationMs - a.durationMs);
}
