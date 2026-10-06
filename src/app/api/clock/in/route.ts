import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clockIn } from "@/lib/shift-service";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const result = await clockIn(session.user.id);
    return NextResponse.json({
      ok: true,
      created: result.created,
      shift: serializeShift(result.shift),
    });
  } catch (e) {
    console.error("clock-in error", e);
    return NextResponse.json({ error: "Could not clock in." }, { status: 500 });
  }
}

function serializeShift(shift: NonNullable<Awaited<ReturnType<typeof clockIn>>["shift"]>) {
  return {
    ...shift,
    clockInAt: shift.clockInAt.toISOString(),
    clockOutAt: shift.clockOutAt?.toISOString() ?? null,
    events: shift.events.map((e) => ({
      ...e,
      occurredAt: e.occurredAt.toISOString(),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
  };
}
