"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ElapsedTimer } from "./ElapsedTimer";
import { LocationPicker } from "./LocationPicker";
import { NoteForm } from "./NoteForm";
import { PunchTimesEditor } from "./PunchTimesEditor";
import { Timeline, type TimelineEventView } from "./Timeline";
import { formatDateTime, formatTime } from "@/lib/time";

type ShiftSummary = {
  id: string;
  status: string;
  clockInAt: string;
  clockOutAt: string | null;
  durationLabel: string;
  events: TimelineEventView[];
};

type TodayData = {
  timezone: string;
  activeShift: null | {
    id: string;
    status: string;
    clockInAt: string;
    elapsedLabel: string;
    longShiftWarning: boolean;
    currentLocation: { id: string; name: string } | null;
    previousLocation: { id: string; name: string } | null;
    events: TimelineEventView[];
    locationTotals: { locationName: string; durationLabel: string }[];
  };
  todayCompleted: ShiftSummary[];
  lastCompleted: ShiftSummary | null;
};

export function TodayClient() {
  const [data, setData] = useState<TodayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [punchShift, setPunchShift] = useState<{
    id: string;
    clockInAt: string;
    clockOutAt: string | null;
    status: string;
    focus?: "clock_in" | "clock_out";
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const res = await fetch("/api/today", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Could not load today.");
      return;
    }
    setData(json);
    setError(null);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(id);
  }, [load]);

  function clockIn() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/clock/in", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Clock in failed.");
        return;
      }
      await load();
    });
  }

  function clockOut() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/clock/out", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Clock out failed.");
        return;
      }
      await load();
    });
  }

  if (!data) {
    return (
      <div className="panel mt-6">
        <p className="text-muted">Loading today…</p>
      </div>
    );
  }

  const active = data.activeShift;
  const editableCompleted =
    data.todayCompleted[0] ?? data.lastCompleted ?? null;

  return (
    <div className="space-y-4 pb-4 pt-2">
      {error ? (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>
      ) : null}

      {!active ? (
        <section className="panel text-center">
          <p className="mb-1 text-sm font-semibold uppercase tracking-[0.14em] text-gold">
            Ready
          </p>
          <h1 className="mb-2 text-2xl font-bold text-brand">Start your workday</h1>
          <p className="mb-6 text-sm text-muted">
            One tap clocks you in. Locations and notes come after.
          </p>
          <button
            className="btn btn-primary w-full text-lg"
            disabled={pending}
            onClick={clockIn}
          >
            Clock In
          </button>
          {editableCompleted ? (
            <div className="mt-5 space-y-3 text-left">
              <p className="text-sm text-muted text-center">
                Last day:{" "}
                {formatDateTime(new Date(editableCompleted.clockInAt), data.timezone)}
                {" · "}
                {editableCompleted.durationLabel}
              </p>
              <button
                className="btn btn-secondary w-full"
                onClick={() =>
                  setPunchShift({
                    id: editableCompleted.id,
                    clockInAt: editableCompleted.clockInAt,
                    clockOutAt: editableCompleted.clockOutAt,
                    status: editableCompleted.status,
                  })
                }
              >
                Edit punch times
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <>
          <section className="panel text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">
              <span className="live-dot" />
              Clocked in
            </div>
            <ElapsedTimer clockInAt={active.clockInAt} />
            <p className="mt-2 text-sm text-muted">
              Since {formatTime(new Date(active.clockInAt), data.timezone)}
            </p>
            <p className="mt-4 text-base font-semibold text-ink">
              {active.currentLocation?.name ?? "Unassigned"}
            </p>
            <button
              className="btn btn-secondary mt-4 w-full"
              onClick={() =>
                setPunchShift({
                  id: active.id,
                  clockInAt: active.clockInAt,
                  clockOutAt: null,
                  status: "ACTIVE",
                  focus: "clock_in",
                })
              }
            >
              Edit punch times
            </button>
            {active.longShiftWarning ? (
              <p className="mt-3 rounded-lg bg-gold-soft px-3 py-2 text-sm text-ink">
                This shift has been open a long time. Edit punch out here, or clock out when
                done.
              </p>
            ) : null}
          </section>

          <section className="grid grid-cols-2 gap-3">
            <button
              className="btn btn-gold"
              disabled={pending}
              onClick={() => setPickerOpen(true)}
            >
              Change Location
            </button>
            <button
              className="btn btn-secondary"
              disabled={pending}
              onClick={() => setNoteOpen(true)}
            >
              Add Note
            </button>
          </section>

          <button
            className="btn btn-danger w-full"
            disabled={pending}
            onClick={clockOut}
          >
            Clock Out
          </button>

          {active.locationTotals.length > 0 ? (
            <section className="panel">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
                Location totals
              </h2>
              <ul className="space-y-1.5">
                {active.locationTotals.map((t) => (
                  <li key={t.locationName} className="flex justify-between text-sm">
                    <span>{t.locationName}</span>
                    <span className="font-semibold tabular-nums">{t.durationLabel}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="panel">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
              Today timeline
            </h2>
            <Timeline events={active.events} timezone={data.timezone} />
            <button
              className="btn btn-secondary mt-4 w-full"
              onClick={() =>
                setPunchShift({
                  id: active.id,
                  clockInAt: active.clockInAt,
                  clockOutAt: null,
                  status: "ACTIVE",
                })
              }
            >
              Edit punch in / out
            </button>
          </section>
        </>
      )}

      <LocationPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onChanged={() => void load()}
        currentLocationId={active?.currentLocation?.id ?? null}
        previousLocation={active?.previousLocation ?? null}
      />
      <NoteForm
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        onSaved={() => void load()}
      />
      {punchShift ? (
        <PunchTimesEditor
          open
          onClose={() => setPunchShift(null)}
          onSaved={() => void load()}
          shiftId={punchShift.id}
          clockInAt={punchShift.clockInAt}
          clockOutAt={punchShift.clockOutAt}
          status={punchShift.status}
          timezone={data.timezone}
          focus={punchShift.focus}
        />
      ) : null}
    </div>
  );
}
