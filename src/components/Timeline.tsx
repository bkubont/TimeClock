"use client";

import { formatTime } from "@/lib/time";

export type TimelineEventView = {
  id: string;
  type: string;
  occurredAt: string;
  locationName?: string | null;
  noteText?: string | null;
  noteCategory?: string | null;
};

function labelFor(event: TimelineEventView): string {
  switch (event.type) {
    case "CLOCK_IN":
      return "Clocked in";
    case "CLOCK_OUT":
      return "Clocked out";
    case "LOCATION_CHANGE":
      return event.locationName
        ? `Arrived at ${event.locationName}`
        : "Location cleared (Unassigned)";
    case "NOTE": {
      const chip =
        event.noteCategory === "ERRAND"
          ? "Errand"
          : event.noteCategory === "SUPPLY_RUN"
            ? "Supply run"
            : event.noteCategory === "GENERAL"
              ? "General"
              : null;
      return chip ? `${chip} — ${event.noteText ?? ""}` : (event.noteText ?? "Note");
    }
    default:
      return event.type;
  }
}

export function Timeline({
  events,
  timezone = "America/Detroit",
}: {
  events: TimelineEventView[];
  timezone?: string;
}) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted">No timeline events yet for this shift.</p>
    );
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );

  return (
    <ol className="space-y-3">
      {sorted.map((event) => (
        <li key={event.id} className="flex gap-3">
          <div className="w-16 shrink-0 pt-0.5 text-xs font-semibold text-brand">
            {formatTime(new Date(event.occurredAt), timezone)}
          </div>
          <div className="min-w-0 flex-1 border-l-2 border-brand-soft pl-3">
            <p className="text-sm font-semibold text-ink">{labelFor(event)}</p>
            {event.type === "NOTE" && event.locationName ? (
              <p className="mt-0.5 text-xs text-muted">at {event.locationName}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
