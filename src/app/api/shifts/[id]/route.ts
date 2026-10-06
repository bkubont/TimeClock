import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  clockInAt: z.string().min(1).optional(),
  clockOutAt: z.string().min(1).nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  const shift = await prisma.shift.findFirst({
    where: { id, ownerId: session.user.id },
    include: {
      events: {
        include: { location: true },
        orderBy: { occurredAt: "asc" },
      },
    },
  });
  if (!shift) {
    return NextResponse.json({ error: "Shift not found." }, { status: 404 });
  }

  return NextResponse.json({
    shift: {
      ...shift,
      clockInAt: shift.clockInAt.toISOString(),
      clockOutAt: shift.clockOutAt?.toISOString() ?? null,
      events: shift.events.map((e) => ({
        ...e,
        occurredAt: e.occurredAt.toISOString(),
      })),
    },
  });
}

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
      return NextResponse.json({ error: "Invalid correction data." }, { status: 400 });
    }

    const shift = await prisma.shift.findFirst({
      where: { id, ownerId: session.user.id },
      include: { events: true },
    });
    if (!shift) {
      return NextResponse.json({ error: "Shift not found." }, { status: 404 });
    }

    const clockInAt = parsed.data.clockInAt
      ? new Date(parsed.data.clockInAt)
      : shift.clockInAt;
    const clockOutAt =
      parsed.data.clockOutAt === undefined
        ? shift.clockOutAt
        : parsed.data.clockOutAt
          ? new Date(parsed.data.clockOutAt)
          : null;

    if (Number.isNaN(clockInAt.getTime())) {
      return NextResponse.json({ error: "Invalid punch-in time." }, { status: 400 });
    }
    if (clockOutAt && Number.isNaN(clockOutAt.getTime())) {
      return NextResponse.json({ error: "Invalid punch-out time." }, { status: 400 });
    }

    if (clockOutAt && clockOutAt.getTime() <= clockInAt.getTime()) {
      return NextResponse.json(
        { error: "Clock out must be later than clock in." },
        { status: 400 },
      );
    }

    const midEvents = shift.events.filter(
      (e) => e.type !== "CLOCK_IN" && e.type !== "CLOCK_OUT",
    );
    const endBound = clockOutAt ?? new Date();
    for (const ev of midEvents) {
      if (
        ev.occurredAt.getTime() < clockInAt.getTime() ||
        ev.occurredAt.getTime() > endBound.getTime()
      ) {
        return NextResponse.json(
          {
            error:
              "Correction would leave timeline events outside the shift. Move or delete those events first.",
          },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextStatus = clockOutAt ? "COMPLETED" : "ACTIVE";

      // Only one ACTIVE shift allowed — refuse reopening if another is active.
      if (nextStatus === "ACTIVE" && shift.status === "COMPLETED") {
        const other = await tx.shift.findFirst({
          where: { ownerId: session.user.id, status: "ACTIVE", NOT: { id: shift.id } },
        });
        if (other) {
          throw new Error("OTHER_ACTIVE_SHIFT");
        }
      }

      const s = await tx.shift.update({
        where: { id: shift.id },
        data: {
          clockInAt,
          clockOutAt,
          status: nextStatus,
        },
      });

      const clockInEvent = await tx.timelineEvent.findFirst({
        where: { shiftId: shift.id, type: "CLOCK_IN" },
      });
      if (clockInEvent) {
        await tx.timelineEvent.update({
          where: { id: clockInEvent.id },
          data: { occurredAt: clockInAt },
        });
      }

      const clockOutEvent = await tx.timelineEvent.findFirst({
        where: { shiftId: shift.id, type: "CLOCK_OUT" },
      });
      if (clockOutAt) {
        if (clockOutEvent) {
          await tx.timelineEvent.update({
            where: { id: clockOutEvent.id },
            data: { occurredAt: clockOutAt },
          });
        } else {
          await tx.timelineEvent.create({
            data: {
              shiftId: shift.id,
              type: "CLOCK_OUT",
              occurredAt: clockOutAt,
            },
          });
        }
      } else if (clockOutEvent) {
        await tx.timelineEvent.delete({ where: { id: clockOutEvent.id } });
      }

      return tx.shift.findUniqueOrThrow({
        where: { id: s.id },
        include: {
          events: {
            include: { location: true },
            orderBy: { occurredAt: "asc" },
          },
        },
      });
    });

    return NextResponse.json({
      ok: true,
      shift: {
        ...updated,
        clockInAt: updated.clockInAt.toISOString(),
        clockOutAt: updated.clockOutAt?.toISOString() ?? null,
        events: updated.events.map((e) => ({
          ...e,
          occurredAt: e.occurredAt.toISOString(),
        })),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message === "OTHER_ACTIVE_SHIFT") {
      return NextResponse.json(
        { error: "Another shift is already active. Clock out first." },
        { status: 400 },
      );
    }
    console.error("shift correction error", e);
    return NextResponse.json({ error: "Could not save correction." }, { status: 500 });
  }
}
