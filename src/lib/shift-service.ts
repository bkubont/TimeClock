import { prisma } from "./prisma";
import { nowUtc } from "./time";

export async function getActiveShift(ownerId: string) {
  return prisma.shift.findFirst({
    where: { ownerId, status: "ACTIVE" },
    include: {
      events: {
        include: { location: true },
        orderBy: { occurredAt: "asc" },
      },
    },
  });
}

export async function getTodayShifts(ownerId: string, dayStart: Date, dayEnd: Date) {
  return prisma.shift.findMany({
    where: {
      ownerId,
      clockInAt: { gte: dayStart, lte: dayEnd },
    },
    include: {
      events: {
        include: { location: true },
        orderBy: { occurredAt: "asc" },
      },
    },
    orderBy: { clockInAt: "desc" },
  });
}

/** Idempotent clock-in: returns existing active shift if present. */
export async function clockIn(ownerId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.shift.findFirst({
      where: { ownerId, status: "ACTIVE" },
      include: {
        events: {
          include: { location: true },
          orderBy: { occurredAt: "asc" },
        },
      },
    });
    if (existing) return { shift: existing, created: false };

    const at = nowUtc();
    const shift = await tx.shift.create({
      data: {
        ownerId,
        clockInAt: at,
        status: "ACTIVE",
        events: {
          create: {
            type: "CLOCK_IN",
            occurredAt: at,
          },
        },
      },
      include: {
        events: {
          include: { location: true },
          orderBy: { occurredAt: "asc" },
        },
      },
    });
    return { shift, created: true };
  });
}

/** Idempotent clock-out: no-op if already completed / no active shift. */
export async function clockOut(ownerId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.shift.findFirst({
      where: { ownerId, status: "ACTIVE" },
      include: {
        events: {
          include: { location: true },
          orderBy: { occurredAt: "asc" },
        },
      },
    });
    if (!existing) {
      const last = await tx.shift.findFirst({
        where: { ownerId, status: "COMPLETED" },
        include: {
          events: {
            include: { location: true },
            orderBy: { occurredAt: "asc" },
          },
        },
        orderBy: { clockOutAt: "desc" },
      });
      return { shift: last, created: false };
    }

    const at = nowUtc();
    if (at.getTime() <= existing.clockInAt.getTime()) {
      throw new Error("CLOCK_OUT_BEFORE_IN");
    }

    const shift = await tx.shift.update({
      where: { id: existing.id },
      data: {
        clockOutAt: at,
        status: "COMPLETED",
        events: {
          create: {
            type: "CLOCK_OUT",
            occurredAt: at,
          },
        },
      },
      include: {
        events: {
          include: { location: true },
          orderBy: { occurredAt: "asc" },
        },
      },
    });
    return { shift, created: true };
  });
}

export async function changeLocation(
  ownerId: string,
  locationId: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const shift = await tx.shift.findFirst({
      where: { ownerId, status: "ACTIVE" },
    });
    if (!shift) throw new Error("NO_ACTIVE_SHIFT");

    let location = null;
    if (locationId) {
      location = await tx.location.findFirst({
        where: { id: locationId, ownerId, archived: false },
      });
      if (!location) throw new Error("LOCATION_NOT_FOUND");
      await tx.location.update({
        where: { id: location.id },
        data: { lastUsedAt: nowUtc() },
      });
    }

    const at = nowUtc();
    const event = await tx.timelineEvent.create({
      data: {
        shiftId: shift.id,
        type: "LOCATION_CHANGE",
        occurredAt: at,
        locationId: location?.id ?? null,
      },
      include: { location: true },
    });

    return event;
  });
}

export async function addNote(
  ownerId: string,
  noteText: string,
  noteCategory?: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const shift = await tx.shift.findFirst({
      where: { ownerId, status: "ACTIVE" },
      include: {
        events: {
          where: { type: "LOCATION_CHANGE" },
          orderBy: { occurredAt: "desc" },
          take: 1,
        },
      },
    });
    if (!shift) throw new Error("NO_ACTIVE_SHIFT");

    const currentLocationId = shift.events[0]?.locationId ?? null;
    const at = nowUtc();

    return tx.timelineEvent.create({
      data: {
        shiftId: shift.id,
        type: "NOTE",
        occurredAt: at,
        locationId: currentLocationId,
        noteText: noteText.trim(),
        noteCategory: noteCategory ?? null,
      },
      include: { location: true },
    });
  });
}

export function currentLocationFromEvents(
  events: { type: string; locationId: string | null; location?: { id: string; name: string } | null; occurredAt: Date }[],
) {
  const changes = events
    .filter((e) => e.type === "LOCATION_CHANGE")
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  if (changes.length === 0) return null;
  return changes[0].locationId
    ? { id: changes[0].locationId, name: changes[0].location?.name ?? "Unknown" }
    : null;
}

export function previousLocationFromEvents(
  events: { type: string; locationId: string | null; location?: { id: string; name: string } | null; occurredAt: Date }[],
) {
  const changes = events
    .filter((e) => e.type === "LOCATION_CHANGE" && e.locationId)
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  if (changes.length < 2) return null;
  const currentId = changes[0].locationId;
  const prev = changes.find((c) => c.locationId !== currentId);
  if (!prev?.locationId) return null;
  return { id: prev.locationId, name: prev.location?.name ?? "Unknown" };
}
