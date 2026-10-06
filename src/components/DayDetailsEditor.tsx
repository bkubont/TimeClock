"use client";

import { useEffect, useState, useTransition } from "react";
import { PunchTimesEditor } from "./PunchTimesEditor";
import {
  DEFAULT_TZ,
  formatTime,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/time";

export type EditableEvent = {
  id: string;
  type: string;
  occurredAt: string;
  locationId?: string | null;
  locationName?: string | null;
  noteText?: string | null;
  noteCategory?: string | null;
};

type LocationOption = { id: string; name: string };

type Props = {
  shiftId: string;
  clockInAt: string;
  clockOutAt: string | null;
  status: string;
  events: EditableEvent[];
  timezone?: string;
  onSaved: () => void;
};

function eventLabel(event: EditableEvent): string {
  switch (event.type) {
    case "CLOCK_IN":
      return "Punched in";
    case "CLOCK_OUT":
      return "Punched out";
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

export function DayDetailsEditor({
  shiftId,
  clockInAt,
  clockOutAt,
  status,
  events,
  timezone = DEFAULT_TZ,
  onSaved,
}: Props) {
  const [punchOpen, setPunchOpen] = useState(false);
  const [punchFocus, setPunchFocus] = useState<"clock_in" | "clock_out">("clock_in");
  const [editingEvent, setEditingEvent] = useState<EditableEvent | null>(null);
  const [eventTime, setEventTime] = useState("");
  const [eventNote, setEventNote] = useState("");
  const [eventCategory, setEventCategory] = useState<string>("");
  const [eventLocationId, setEventLocationId] = useState<string>("");
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/locations?archived=1")
      .then((r) => r.json())
      .then((d) =>
        setLocations(
          (d.locations ?? []).map((l: { id: string; name: string }) => ({
            id: l.id,
            name: l.name,
          })),
        ),
      )
      .catch(() => undefined);
  }, []);

  function openPunch(focus: "clock_in" | "clock_out" = "clock_in") {
    setPunchFocus(focus);
    setPunchOpen(true);
  }

  function openEventEdit(event: EditableEvent) {
    if (event.type === "CLOCK_IN") {
      openPunch("clock_in");
      return;
    }
    if (event.type === "CLOCK_OUT") {
      openPunch("clock_out");
      return;
    }
    setEditingEvent(event);
    setEventTime(toDatetimeLocalValue(new Date(event.occurredAt), timezone));
    setEventNote(event.noteText ?? "");
    setEventCategory(event.noteCategory ?? "");
    setEventLocationId(event.locationId ?? "");
    setError(null);
  }

  function saveEvent() {
    if (!editingEvent) return;
    setError(null);
    startTransition(async () => {
      const body: Record<string, unknown> = {
        occurredAt: fromDatetimeLocalValue(eventTime, timezone).toISOString(),
      };
      if (editingEvent.type === "NOTE") {
        body.noteText = eventNote;
        body.noteCategory = eventCategory || null;
      }
      if (editingEvent.type === "LOCATION_CHANGE") {
        body.locationId = eventLocationId || null;
      }
      const res = await fetch(`/api/events/${editingEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not update event.");
        return;
      }
      setEditingEvent(null);
      onSaved();
    });
  }

  function deleteEvent(event: EditableEvent) {
    if (event.type === "CLOCK_IN" || event.type === "CLOCK_OUT") return;
    if (!window.confirm("Delete this event? Location totals will recalculate.")) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not delete event.");
        return;
      }
      setEditingEvent(null);
      onSaved();
    });
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );

  return (
    <div className="mt-3 space-y-4 border-t border-black/8 pt-3">
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="no-print space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
              Punch times
            </h3>
            <p className="text-sm text-ink">
              {formatTime(new Date(clockInAt), timezone)}
              {" – "}
              {clockOutAt ? formatTime(new Date(clockOutAt), timezone) : "Open"}
            </p>
          </div>
          <button className="btn btn-primary min-h-11 px-4" onClick={() => openPunch()}>
            Edit
          </button>
        </div>
        {status === "ACTIVE" ? (
          <p className="text-xs text-danger">
            Open shift — edit punch out to close a forgotten clock-out.
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
          Timeline
        </h3>
        <ol className="space-y-3">
          {sorted.map((event) => (
            <li key={event.id} className="flex gap-3">
              <div className="w-16 shrink-0 pt-0.5 text-xs font-semibold text-brand">
                {formatTime(new Date(event.occurredAt), timezone)}
              </div>
              <div className="min-w-0 flex-1 border-l-2 border-brand-soft pl-3">
                <p className="text-sm font-semibold text-ink">{eventLabel(event)}</p>
                <div className="mt-1 flex gap-2 no-print">
                  <button
                    className="text-xs font-semibold text-brand"
                    onClick={() => openEventEdit(event)}
                  >
                    Edit
                  </button>
                  {event.type === "NOTE" || event.type === "LOCATION_CHANGE" ? (
                    <button
                      className="text-xs font-semibold text-danger"
                      onClick={() => deleteEvent(event)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <PunchTimesEditor
        open={punchOpen}
        onClose={() => setPunchOpen(false)}
        onSaved={onSaved}
        shiftId={shiftId}
        clockInAt={clockInAt}
        clockOutAt={clockOutAt}
        status={status}
        timezone={timezone}
        focus={punchFocus}
      />

      {editingEvent ? (
        <>
          <button
            className="sheet-backdrop"
            aria-label="Close"
            onClick={() => setEditingEvent(null)}
          />
          <div className="sheet" role="dialog" aria-label="Edit event">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand">Edit event</h2>
              <button
                className="btn btn-ghost min-h-10 px-3"
                onClick={() => setEditingEvent(null)}
              >
                Close
              </button>
            </div>
            <label className="mb-3 block text-sm font-semibold">
              Time
              <input
                type="datetime-local"
                className="field mt-1"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
              />
            </label>
            {editingEvent.type === "NOTE" ? (
              <>
                <label className="mb-3 block text-sm font-semibold">
                  Note
                  <textarea
                    className="field mt-1 min-h-24"
                    value={eventNote}
                    onChange={(e) => setEventNote(e.target.value)}
                  />
                </label>
                <label className="mb-3 block text-sm font-semibold">
                  Category
                  <select
                    className="field mt-1"
                    value={eventCategory}
                    onChange={(e) => setEventCategory(e.target.value)}
                  >
                    <option value="">None</option>
                    <option value="ERRAND">Errand</option>
                    <option value="SUPPLY_RUN">Supply Run</option>
                    <option value="GENERAL">General</option>
                  </select>
                </label>
              </>
            ) : null}
            {editingEvent.type === "LOCATION_CHANGE" ? (
              <label className="mb-3 block text-sm font-semibold">
                Location
                <select
                  className="field mt-1"
                  value={eventLocationId}
                  onChange={(e) => setEventLocationId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="flex gap-2">
              <button
                className="btn btn-danger flex-1"
                disabled={pending}
                onClick={() => deleteEvent(editingEvent)}
              >
                Delete
              </button>
              <button
                className="btn btn-primary flex-1"
                disabled={pending}
                onClick={saveEvent}
              >
                Save
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
