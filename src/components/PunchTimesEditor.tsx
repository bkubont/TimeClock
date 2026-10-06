"use client";

import { useEffect, useState, useTransition } from "react";
import {
  DEFAULT_TZ,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/time";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  shiftId: string;
  clockInAt: string;
  clockOutAt: string | null;
  status: string;
  timezone?: string;
  /** When set, focus that field first (clock_in | clock_out). */
  focus?: "clock_in" | "clock_out";
};

export function PunchTimesEditor({
  open,
  onClose,
  onSaved,
  shiftId,
  clockInAt,
  clockOutAt,
  status,
  timezone = DEFAULT_TZ,
  focus = "clock_in",
}: Props) {
  const [inValue, setInValue] = useState(toDatetimeLocalValue(new Date(clockInAt), timezone));
  const [outValue, setOutValue] = useState(
    clockOutAt ? toDatetimeLocalValue(new Date(clockOutAt), timezone) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setInValue(toDatetimeLocalValue(new Date(clockInAt), timezone));
    setOutValue(clockOutAt ? toDatetimeLocalValue(new Date(clockOutAt), timezone) : "");
    setError(null);
    setSavedMsg(null);
  }, [open, clockInAt, clockOutAt, timezone]);

  if (!open) return null;

  function save() {
    setError(null);
    setSavedMsg(null);
    if (!inValue) {
      setError("Punch in time is required.");
      return;
    }
    startTransition(async () => {
      const body = {
        clockInAt: fromDatetimeLocalValue(inValue, timezone).toISOString(),
        clockOutAt: outValue
          ? fromDatetimeLocalValue(outValue, timezone).toISOString()
          : null,
      };
      const res = await fetch(`/api/shifts/${shiftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save punch times.");
        return;
      }
      setSavedMsg("Punch times saved.");
      onSaved();
      window.setTimeout(() => onClose(), 500);
    });
  }

  return (
    <>
      <button className="sheet-backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Edit punch times">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand">Edit punch times</h2>
          <button className="btn btn-ghost min-h-10 px-3" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="mb-3 text-sm text-muted">
          Change clock in / clock out. Times use America/Detroit. Saving recalculates the day
          total.
        </p>

        {status === "ACTIVE" ? (
          <p className="mb-3 rounded-lg bg-gold-soft px-3 py-2 text-sm text-ink">
            This shift is still open. Set a punch-out time to close it, or leave punch out blank
            to keep it running.
          </p>
        ) : null}

        {error ? <p className="mb-2 text-sm text-danger">{error}</p> : null}
        {savedMsg ? <p className="mb-2 text-sm text-success">{savedMsg}</p> : null}

        <label className="mb-3 block text-sm font-semibold">
          Punch in
          <input
            type="datetime-local"
            className="field mt-1"
            value={inValue}
            onChange={(e) => setInValue(e.target.value)}
            autoFocus={focus === "clock_in"}
          />
        </label>

        <label className="mb-4 block text-sm font-semibold">
          Punch out
          <input
            type="datetime-local"
            className="field mt-1"
            value={outValue}
            onChange={(e) => setOutValue(e.target.value)}
            autoFocus={focus === "clock_out"}
          />
        </label>

        {outValue ? (
          <button
            type="button"
            className="btn btn-ghost mb-3 w-full min-h-11 text-sm"
            onClick={() => setOutValue("")}
          >
            Clear punch out (leave open)
          </button>
        ) : null}

        <button className="btn btn-primary w-full" disabled={pending} onClick={save}>
          Save punch times
        </button>
      </div>
    </>
  );
}
