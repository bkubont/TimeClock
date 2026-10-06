import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
  displayName: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid registration data." }, { status: 400 });
    }
    if (parsed.data.password !== parsed.data.confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    // Atomic one-time owner lock — reject if any owner already exists.
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.owner.count();
      if (existing > 0) {
        return { locked: true as const };
      }
      const passwordHash = await bcrypt.hash(parsed.data.password, 12);
      const owner = await tx.owner.create({
        data: {
          email: parsed.data.email.toLowerCase().trim(),
          passwordHash,
          displayName: parsed.data.displayName?.trim() || null,
          timezone: "America/Detroit",
        },
        select: { id: true, email: true },
      });
      return { locked: false as const, owner };
    });

    if (result.locked) {
      return NextResponse.json(
        { error: "Owner account already exists. Registration is closed." },
        { status: 403 },
      );
    }

    return NextResponse.json({ ok: true, owner: result.owner });
  } catch (e) {
    console.error("register error", e);
    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }
}
