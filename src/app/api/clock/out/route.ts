import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { clockOut } from "@/lib/shift-service";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const result = await clockOut(session.user.id);
    return NextResponse.json({
      ok: true,
      created: result.created,
      shift: result.shift
        ? {
            ...result.shift,
            clockInAt: result.shift.clockInAt.toISOString(),
            clockOutAt: result.shift.clockOutAt?.toISOString() ?? null,
            events: result.shift.events.map((e) => ({
              ...e,
              occurredAt: e.occurredAt.toISOString(),
              createdAt: e.createdAt.toISOString(),
              updatedAt: e.updatedAt.toISOString(),
            })),
          }
        : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "CLOCK_OUT_FAILED";
    if (message === "CLOCK_OUT_BEFORE_IN") {
      return NextResponse.json(
        { error: "Clock out must be later than clock in." },
        { status: 400 },
      );
    }
    console.error("clock-out error", e);
    return NextResponse.json({ error: "Could not clock out." }, { status: 500 });
  }
}
