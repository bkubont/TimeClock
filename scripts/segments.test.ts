import assert from "node:assert/strict";
import { deriveSegments, totalsByLocation } from "../src/lib/segments";

const clockIn = new Date("2026-10-06T12:03:00.000Z"); // 8:03 AM EDT
const smithAt = new Date("2026-10-06T12:08:00.000Z");
const jonesAt = new Date("2026-10-06T15:25:00.000Z");
const backSmith = new Date("2026-10-06T18:10:00.000Z");
const clockOut = new Date("2026-10-06T20:37:00.000Z");

const events = [
  {
    id: "1",
    type: "CLOCK_IN",
    occurredAt: clockIn,
    locationId: null,
  },
  {
    id: "2",
    type: "LOCATION_CHANGE",
    occurredAt: smithAt,
    locationId: "smith",
    location: { id: "smith", name: "Smith House" },
  },
  {
    id: "3",
    type: "NOTE",
    occurredAt: new Date("2026-10-06T14:42:00.000Z"),
    locationId: "smith",
    location: { id: "smith", name: "Smith House" },
    noteText: "screws",
  },
  {
    id: "4",
    type: "LOCATION_CHANGE",
    occurredAt: jonesAt,
    locationId: "jones",
    location: { id: "jones", name: "Jones Cabin" },
  },
  {
    id: "5",
    type: "LOCATION_CHANGE",
    occurredAt: backSmith,
    locationId: "smith",
    location: { id: "smith", name: "Smith House" },
  },
  {
    id: "6",
    type: "CLOCK_OUT",
    occurredAt: clockOut,
    locationId: null,
  },
];

const segments = deriveSegments(clockIn, clockOut, events);
const totals = totalsByLocation(segments);
const dayMs = clockOut.getTime() - clockIn.getTime();
const sum = totals.reduce((a, t) => a + t.durationMs, 0);

assert.equal(segments[0].locationName, "Unassigned");
assert.equal(segments[0].durationMs, smithAt.getTime() - clockIn.getTime());
assert.equal(sum, dayMs);

const smith = totals.find((t) => t.locationName === "Smith House");
const jones = totals.find((t) => t.locationName === "Jones Cabin");
const unassigned = totals.find((t) => t.locationName === "Unassigned");
assert.ok(smith && jones && unassigned);
assert.equal(
  smith!.durationMs,
  jonesAt.getTime() - smithAt.getTime() + (clockOut.getTime() - backSmith.getTime()),
);
assert.equal(jones!.durationMs, backSmith.getTime() - jonesAt.getTime());

console.log("segments.test.ts: ok");
