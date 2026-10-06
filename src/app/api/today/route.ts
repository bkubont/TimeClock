import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  currentLocationFromEvents,
  getActiveShift,
  previousLocationFromEvents,
} from "@/lib/shift-service";
import { deriveSegments, totalsByLocation } from "@/lib/segments";
import {
  DEFAULT_TZ,
  LONG_SHIFT_MS,
  elapsedMs,
  formatDuration,
  nowUtc,
  zonedDayBounds,
} from "@/lib/time";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const owner = await prisma.owner.findUnique({
    where: { id: session.user.id },
    select: { timezone: true, email: true, displayName: true },
  });
  const tz = owner?.timezone ?? DEFAULT_TZ;
  const { start, end } = zonedDayBounds(new Date(), tz);

  const active = await getActiveShift(session.user.id);
  const todayCompleted = await prisma.shift.findMany({
    where: {
      ownerId: session.user.id,
      status: "COMPLETED",
      clockInAt: { gte: start, lte: end },
    },
    include: {
      events: {
        include: { location: true },
        orderBy: { occurredAt: "asc" },
      },
    },
    orderBy: { clockInAt: "desc" },
  });

  const lastCompleted = await prisma.shift.findFirst({
    where: { ownerId: session.user.id, status: "COMPLETED" },
    orderBy: { clockOutAt: "desc" },
    include: {
      events: {
        include: { location: true },
        orderBy: { occurredAt: "asc" },
      },
    },
  });

  const asOf = nowUtc();
  let payload = null;
  if (active) {
    const segments = deriveSegments(active.clockInAt, active.clockOutAt, active.events, asOf);
    const elapsed = elapsedMs(active.clockInAt, asOf);
    payload = {
      id: active.id,
      status: active.status,
      clockInAt: active.clockInAt.toISOString(),
      clockOutAt: null,
      elapsedMs: elapsed,
      elapsedLabel: formatDuration(elapsed),
      longShiftWarning: elapsed >= LONG_SHIFT_MS,
      currentLocation: currentLocationFromEvents(active.events),
      previousLocation: previousLocationFromEvents(active.events),
      events: active.events.map(serializeEvent),
      segments: segments.map(serializeSegment),
      locationTotals: totalsByLocation(segments).map((t) => ({
        ...t,
        durationLabel: formatDuration(t.durationMs),
      })),
    };
  }

  return NextResponse.json({
    timezone: tz,
    owner: { email: owner?.email, displayName: owner?.displayName },
    activeShift: payload,
    todayCompleted: todayCompleted.map((s) => serializeShiftSummary(s, asOf)),
    lastCompleted: lastCompleted ? serializeShiftSummary(lastCompleted, asOf) : null,
  });
}

function serializeEvent(e: {
  id: string;
  type: string;
  occurredAt: Date;
  locationId: string | null;
  noteText: string | null;
  noteCategory: string | null;
  location: { id: string; name: string } | null;
}) {
  return {
    id: e.id,
    type: e.type,
    occurredAt: e.occurredAt.toISOString(),
    locationId: e.locationId,
    locationName: e.location?.name ?? null,
    noteText: e.noteText,
    noteCategory: e.noteCategory,
  };
}

function serializeSegment(s: {
  locationId: string | null;
  locationName: string;
  startAt: Date;
  endAt: Date;
  durationMs: number;
}) {
  return {
    ...s,
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
    durationLabel: formatDuration(s.durationMs),
  };
}

function serializeShiftSummary(
  s: {
    id: string;
    status: string;
    clockInAt: Date;
    clockOutAt: Date | null;
    events: {
      id: string;
      type: string;
      occurredAt: Date;
      locationId: string | null;
      noteText: string | null;
      noteCategory: string | null;
      location: { id: string; name: string } | null;
    }[];
  },
  asOf: Date,
) {
  const end = s.clockOutAt ?? asOf;
  const duration = elapsedMs(s.clockInAt, end);
  const segments = deriveSegments(s.clockInAt, s.clockOutAt, s.events, asOf);
  return {
    id: s.id,
    status: s.status,
    clockInAt: s.clockInAt.toISOString(),
    clockOutAt: s.clockOutAt?.toISOString() ?? null,
    durationMs: duration,
    durationLabel: formatDuration(duration),
    events: s.events.map(serializeEvent),
    locationTotals: totalsByLocation(segments).map((t) => ({
      ...t,
      durationLabel: formatDuration(t.durationMs),
    })),
  };
}
