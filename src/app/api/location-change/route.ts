import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { changeLocation } from "@/lib/shift-service";

const schema = z.object({
  locationId: z.string().nullable(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid location." }, { status: 400 });
    }

    const event = await changeLocation(session.user.id, parsed.data.locationId);
    return NextResponse.json({
      ok: true,
      event: {
        ...event,
        occurredAt: event.occurredAt.toISOString(),
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message === "NO_ACTIVE_SHIFT") {
      return NextResponse.json({ error: "Clock in before changing location." }, { status: 400 });
    }
    if (message === "LOCATION_NOT_FOUND") {
      return NextResponse.json({ error: "Location not found." }, { status: 404 });
    }
    console.error("location-change error", e);
    return NextResponse.json({ error: "Could not change location." }, { status: 500 });
  }
}
