import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deriveSegments } from "@/lib/segments";
import {
  DEFAULT_TZ,
  elapsedMs,
  historyRange,
  toDecimalHours,
  type HistoryFilter,
} from "@/lib/time";

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

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
    orderBy: { clockInAt: "asc" },
  });

  const headers = [
    "date",
    "shift_clock_in",
    "shift_clock_out",
    "daily_duration_ms",
    "daily_decimal_hours",
    "event_timestamp",
    "event_type",
    "location_name",
    "note_category",
    "note_text",
    "segment_start",
    "segment_end",
    "segment_duration_ms",
    "segment_decimal_hours",
  ];

  const rows: string[] = [headers.join(",")];

  for (const shift of shifts) {
    const dailyMs = elapsedMs(shift.clockInAt, shift.clockOutAt ?? new Date());
    const segments = deriveSegments(shift.clockInAt, shift.clockOutAt, shift.events);
    const date = shift.clockInAt.toISOString().slice(0, 10);

    for (const event of shift.events) {
      rows.push(
        [
          csvEscape(date),
          csvEscape(shift.clockInAt.toISOString()),
          csvEscape(shift.clockOutAt?.toISOString() ?? ""),
          csvEscape(dailyMs),
          csvEscape(toDecimalHours(dailyMs)),
          csvEscape(event.occurredAt.toISOString()),
          csvEscape(event.type),
          csvEscape(event.location?.name ?? ""),
          csvEscape(event.noteCategory),
          csvEscape(event.noteText),
          "",
          "",
          "",
          "",
        ].join(","),
      );
    }

    for (const seg of segments) {
      rows.push(
        [
          csvEscape(date),
          csvEscape(shift.clockInAt.toISOString()),
          csvEscape(shift.clockOutAt?.toISOString() ?? ""),
          csvEscape(dailyMs),
          csvEscape(toDecimalHours(dailyMs)),
          "",
          "SEGMENT",
          csvEscape(seg.locationName),
          "",
          "",
          csvEscape(seg.startAt.toISOString()),
          csvEscape(seg.endAt.toISOString()),
          csvEscape(seg.durationMs),
          csvEscape(toDecimalHours(seg.durationMs)),
        ].join(","),
      );
    }
  }

  const body = rows.join("\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="squarethisup-timecard.csv"`,
    },
  });
}
