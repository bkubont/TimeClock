import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deriveSegments, totalsByLocation } from "@/lib/segments";
import {
  DEFAULT_TZ,
  elapsedMs,
  formatDuration,
  historyRange,
  toDecimalHours,
  type HistoryFilter,
} from "@/lib/time";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const owner = await prisma.owner.findUnique({
    where: { id: session.user.id },
    select: { timezone: true },
  });
  const tz = owner?.timezone ?? DEFAULT_TZ;

  const { searchParams } = new URL(req.url);
  const filter = (searchParams.get("filter") ?? "this_week") as HistoryFilter;
  const customStart = searchParams.get("start") ?? undefined;
  const customEnd = searchParams.get("end") ?? undefined;
  const view = searchParams.get("view") ?? "by_day";

  const range = historyRange(filter, tz, customStart, customEnd);

  const shifts = await prisma.shift.findMany({
    where: {
      ownerId: session.user.id,
      clockInAt: { gte: range.start, lte: range.end },
    },
    include: {
      events: {
        include: { location: true },
        orderBy: { occurredAt: "asc" },
      },
    },
    orderBy: { clockInAt: "desc" },
  });

  const byDay = shifts.map((s) => {
    const end = s.clockOutAt ?? new Date();
    const durationMs = elapsedMs(s.clockInAt, end);
    const segments = deriveSegments(s.clockInAt, s.clockOutAt, s.events);
    const noteCount = s.events.filter((e) => e.type === "NOTE").length;
    const locationsVisited = [
      ...new Set(
        s.events
          .filter((e) => e.type === "LOCATION_CHANGE" && e.location)
          .map((e) => e.location!.name),
      ),
    ];
    return {
      id: s.id,
      status: s.status,
      clockInAt: s.clockInAt.toISOString(),
      clockOutAt: s.clockOutAt?.toISOString() ?? null,
      durationMs,
      durationLabel: formatDuration(durationMs),
      decimalHours: toDecimalHours(durationMs),
      noteCount,
      locationsVisited,
      locationTotals: totalsByLocation(segments).map((t) => ({
        ...t,
        durationLabel: formatDuration(t.durationMs),
        decimalHours: toDecimalHours(t.durationMs),
      })),
      events: s.events.map((e) => ({
        id: e.id,
        type: e.type,
        occurredAt: e.occurredAt.toISOString(),
        locationId: e.locationId,
        locationName: e.location?.name ?? null,
        noteText: e.noteText,
        noteCategory: e.noteCategory,
      })),
      longOpen: s.status === "ACTIVE" && durationMs >= 14 * 60 * 60 * 1000,
    };
  });

  const allSegments = shifts.flatMap((s) =>
    deriveSegments(s.clockInAt, s.clockOutAt, s.events).map((seg) => ({
      ...seg,
      shiftId: s.id,
    })),
  );
  const byLocation = totalsByLocation(allSegments).map((t) => ({
    ...t,
    durationLabel: formatDuration(t.durationMs),
    decimalHours: toDecimalHours(t.durationMs),
  }));

  const rangeTotalMs = byDay.reduce((sum, d) => sum + d.durationMs, 0);

  return NextResponse.json({
    timezone: tz,
    filter,
    view,
    label: range.label,
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    rangeTotalMs,
    rangeTotalLabel: formatDuration(rangeTotalMs),
    rangeDecimalHours: toDecimalHours(rangeTotalMs),
    byDay,
    byLocation,
    allActivity: byDay.flatMap((d) =>
      d.events.map((e) => ({
        ...e,
        shiftId: d.id,
        shiftClockInAt: d.clockInAt,
        shiftClockOutAt: d.clockOutAt,
      })),
    ),
  });
}
