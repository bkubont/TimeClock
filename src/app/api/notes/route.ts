import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { addNote } from "@/lib/shift-service";

const schema = z.object({
  noteText: z.string().min(1).max(1000),
  noteCategory: z.enum(["ERRAND", "SUPPLY_RUN", "GENERAL"]).optional().nullable(),
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
      return NextResponse.json({ error: "Note text is required." }, { status: 400 });
    }

    const event = await addNote(
      session.user.id,
      parsed.data.noteText,
      parsed.data.noteCategory,
    );

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
      return NextResponse.json({ error: "Clock in before adding a note." }, { status: 400 });
    }
    console.error("note error", e);
    return NextResponse.json({ error: "Could not save note." }, { status: 500 });
  }
}
