import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { changeLocation } from "@/lib/shift-service";
import { nowUtc } from "@/lib/time";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().max(240).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  selectNow: z.boolean().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("archived") === "1";
  const q = searchParams.get("q")?.trim().toLowerCase();

  const locations = await prisma.location.findMany({
    where: {
      ownerId: session.user.id,
      ...(includeArchived ? {} : { archived: false }),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { address: { contains: q } },
              { note: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ archived: "asc" }, { lastUsedAt: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ locations });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const location = await prisma.location.create({
      data: {
        ownerId: session.user.id,
        name: parsed.data.name.trim(),
        address: parsed.data.address?.trim() || null,
        note: parsed.data.note?.trim() || null,
        lastUsedAt: parsed.data.selectNow ? nowUtc() : null,
      },
    });

    let event = null;
    if (parsed.data.selectNow) {
      event = await changeLocation(session.user.id, location.id);
    }

    return NextResponse.json({
      ok: true,
      location,
      event: event
        ? { ...event, occurredAt: event.occurredAt.toISOString() }
        : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message === "NO_ACTIVE_SHIFT") {
      return NextResponse.json({ error: "Clock in before changing location." }, { status: 400 });
    }
    console.error("create location error", e);
    return NextResponse.json({ error: "Could not save location." }, { status: 500 });
  }
}
