"use client";

import { useCallback, useEffect, useState } from "react";
import { Timeline, type TimelineEventView } from "./Timeline";
import { formatDateTime, formatTime } from "@/lib/time";

type DayRow = {
  id: string;
  status: string;
  clockInAt: string;
  clockOutAt: string | null;
  durationLabel: string;
  decimalHours: number;
  noteCount: number;
  locationsVisited: string[];
  locationTotals: { locationName: string; durationLabel: string; decimalHours: number }[];
  events: TimelineEventView[];
  longOpen: boolean;
};

type HistoryData = {
  timezone: string;
  label: string;
  rangeTotalLabel: string;
  rangeDecimalHours: number;
  byDay: DayRow[];
  byLocation: { locationName: string; durationLabel: string; decimalHours: number }[];
  allActivity: (TimelineEventView & { shiftId: string })[];
};

const filters = [
  { id: "this_week", label: "This Week" },
  { id: "last_week", label: "Last Week" },
  { id: "this_month", label: "This Month" },
  { id: "custom", label: "Custom" },
] as const;

const views = [
  { id: "by_day", label: "By day" },
  { id: "by_location", label: "By location" },
  { id: "all_activity", label: "All activity" },
] as const;

export function HistoryClient() {
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("this_week");
  const [view, setView] = useState<(typeof views)[number]["id"]>("by_day");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [data, setData] = useState<HistoryData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ filter, view });
    if (filter === "custom") {
      if (!start || !end) return;
      params.set("start", start);
      params.set("end", end);
    }
    const res = await fetch(`/api/history?${params}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Could not load history.");
      return;
    }
    setData(json);
    setError(null);
  }, [filter, view, start, end]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    const params = new URLSearchParams({ filter });
    if (filter === "custom" && start && end) {
      params.set("start", start);
      params.set("end", end);
    }
    window.location.href = `/api/export/csv?${params}`;
  }

  return (
    <div className="space-y-4 pb-4 pt-2">
      <section className="panel no-print">
        <h1 className="mb-3 text-xl font-bold text-brand">History</h1>
        <div className="mb-3 flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              className={`chip ${filter === f.id ? "active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filter === "custom" ? (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <input
              type="date"
              className="field"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <input
              type="date"
              className="field"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        ) : null}
        <div className="mb-3 flex flex-wrap gap-2">
          {views.map((v) => (
            <button
              key={v.id}
              className={`chip ${view === v.id ? "active" : ""}`}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary flex-1" onClick={() => window.print()}>
            Print
          </button>
          <button className="btn btn-primary flex-1" onClick={exportCsv}>
            CSV
          </button>
        </div>
      </section>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {data ? (
        <>
          <section className="panel print-card">
            <div className="print-only mb-4">
              <h1 className="text-xl font-bold">SquareThisUp Time Clock</h1>
              <p>{data.label}</p>
            </div>
            <p className="text-sm text-muted">{data.label}</p>
            <p className="text-2xl font-bold text-brand">
              {data.rangeTotalLabel}{" "}
              <span className="text-base font-semibold text-muted">
                ({data.rangeDecimalHours}h)
              </span>
            </p>
          </section>

          {view === "by_day"
            ? data.byDay.map((day) => (
                <section key={day.id} className="panel print-card">
                  <button
                    className="w-full text-left no-print"
                    onClick={() =>
                      setExpanded((id) => (id === day.id ? null : day.id))
                    }
                  >
                    <DayHeader day={day} tz={data.timezone} />
                  </button>
                  <div className="print-only">
                    <DayHeader day={day} tz={data.timezone} />
                  </div>
                  <div
                    className={`mt-3 ${
                      expanded === day.id ? "block" : "hidden print:block"
                    }`}
                  >
                    <ul className="mb-3 space-y-1 text-sm">
                      {day.locationTotals.map((t) => (
                        <li key={t.locationName} className="flex justify-between">
                          <span>{t.locationName}</span>
                          <span>
                            {t.durationLabel} ({t.decimalHours}h)
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Timeline events={day.events} timezone={data.timezone} />
                  </div>
                </section>
              ))
            : null}

          {view === "by_location" ? (
            <section className="panel print-card">
              <ul className="space-y-2">
                {data.byLocation.map((t) => (
                  <li key={t.locationName} className="flex justify-between text-sm">
                    <span className="font-semibold">{t.locationName}</span>
                    <span>
                      {t.durationLabel} ({t.decimalHours}h)
                    </span>
                  </li>
                ))}
                {data.byLocation.length === 0 ? (
                  <li className="text-muted">No location time in this range.</li>
                ) : null}
              </ul>
            </section>
          ) : null}

          {view === "all_activity" ? (
            <section className="panel print-card">
              <Timeline events={data.allActivity} timezone={data.timezone} />
            </section>
          ) : null}

          {data.byDay.length === 0 ? (
            <p className="text-sm text-muted">No shifts in this range.</p>
          ) : null}
        </>
      ) : (
        <p className="text-muted">Loading history…</p>
      )}
    </div>
  );
}

function DayHeader({ day, tz }: { day: DayRow; tz: string }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-ink">
            {formatDateTime(new Date(day.clockInAt), tz).split(",")[0]}
          </p>
          <p className="text-sm text-muted">
            {formatTime(new Date(day.clockInAt), tz)}
            {" – "}
            {day.clockOutAt
              ? formatTime(new Date(day.clockOutAt), tz)
              : "Open"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold tabular-nums text-brand">{day.durationLabel}</p>
          <p className="text-xs text-muted">{day.decimalHours}h</p>
        </div>
      </div>
      {day.longOpen ? (
        <p className="mt-2 text-xs font-semibold text-danger">
          Forgotten clock-out? Correct when you can.
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted">
        {day.locationsVisited.length
          ? day.locationsVisited.join(" · ")
          : "Unassigned only"}
        {" · "}
        {day.noteCount} note{day.noteCount === 1 ? "" : "s"}
      </p>
    </>
  );
}
