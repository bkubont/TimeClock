import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  currentLocationFromEvents,
  getActiveShift,
} from "@/lib/shift-service";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  address: z.string().max(240).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  archived: z.boolean().optional(),
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
      return NextResponse.json({ error: "Invalid update." }, { status: 400 });
    }

    const existing = await prisma.location.findFirst({
      where: { id, ownerId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Location not found." }, { status: 404 });
    }

    if (parsed.data.archived === true) {
      const active = await getActiveShift(session.user.id);
      if (active) {
        const current = currentLocationFromEvents(active.events);
        if (current?.id === id) {
          return NextResponse.json(
            {
              error:
                "This location is currently assigned. Change location or clear it before archiving.",
            },
            { status: 400 },
          );
        }
      }
    }

    const location = await prisma.location.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.address !== undefined
          ? { address: parsed.data.address?.trim() || null }
          : {}),
        ...(parsed.data.note !== undefined ? { note: parsed.data.note?.trim() || null } : {}),
        ...(parsed.data.archived !== undefined ? { archived: parsed.data.archived } : {}),
      },
    });

    return NextResponse.json({ ok: true, location });
  } catch (e) {
    console.error("update location error", e);
    return NextResponse.json({ error: "Could not update location." }, { status: 500 });
  }
}
