import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  occurredAt: z.string().datetime().optional(),
  noteText: z.string().max(1000).optional().nullable(),
  noteCategory: z.enum(["ERRAND", "SUPPLY_RUN", "GENERAL"]).optional().nullable(),
  locationId: z.string().nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid edit." }, { status: 400 });
    }

    const event = await prisma.timelineEvent.findFirst({
      where: { id, shift: { ownerId: session.user.id } },
      include: { shift: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    if (event.type === "CLOCK_IN" || event.type === "CLOCK_OUT") {
      return NextResponse.json(
        { error: "Edit shift clock times from day details (coming soon for CLOCK events)." },
        { status: 400 },
      );
    }

    let occurredAt = event.occurredAt;
    if (parsed.data.occurredAt) {
      occurredAt = new Date(parsed.data.occurredAt);
      const shiftStart = event.shift.clockInAt.getTime();
      const shiftEnd = (event.shift.clockOutAt ?? new Date()).getTime();
      if (occurredAt.getTime() < shiftStart || occurredAt.getTime() > shiftEnd) {
        return NextResponse.json(
          { error: "Event time must fall inside the shift." },
          { status: 400 },
        );
      }
    }

    if (parsed.data.locationId) {
      const loc = await prisma.location.findFirst({
        where: { id: parsed.data.locationId, ownerId: session.user.id },
      });
      if (!loc) {
        return NextResponse.json({ error: "Location not found." }, { status: 404 });
      }
    }

    const updated = await prisma.timelineEvent.update({
      where: { id },
      data: {
        occurredAt,
        ...(parsed.data.noteText !== undefined
          ? { noteText: parsed.data.noteText?.trim() || null }
          : {}),
        ...(parsed.data.noteCategory !== undefined
          ? { noteCategory: parsed.data.noteCategory }
          : {}),
        ...(parsed.data.locationId !== undefined
          ? { locationId: parsed.data.locationId }
          : {}),
      },
      include: { location: true },
    });

    return NextResponse.json({
      ok: true,
      event: {
        ...updated,
        occurredAt: updated.occurredAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("event edit error", e);
    return NextResponse.json({ error: "Could not update event." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const event = await prisma.timelineEvent.findFirst({
      where: { id, shift: { ownerId: session.user.id } },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    if (event.type === "CLOCK_IN" || event.type === "CLOCK_OUT") {
      return NextResponse.json(
        { error: "Cannot delete clock in/out events." },
        { status: 400 },
      );
    }

    await prisma.timelineEvent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("event delete error", e);
    return NextResponse.json({ error: "Could not delete event." }, { status: 500 });
  }
}
