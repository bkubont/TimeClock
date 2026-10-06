import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128),
});

/** Request a reset token (returned in JSON for local MVP — no email transport yet). */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Valid email required." }, { status: 400 });
    }

    const owner = await prisma.owner.findUnique({
      where: { email: parsed.data.email.toLowerCase().trim() },
    });

    // Always return ok to avoid account enumeration, but include token only when found (local MVP).
    if (!owner) {
      return NextResponse.json({
        ok: true,
        message: "If that account exists, a reset token was issued.",
      });
    }

    const token = randomBytes(24).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.owner.update({
      where: { id: owner.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expires,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Reset token issued (local MVP — use the token below).",
      token,
    });
  } catch (e) {
    console.error("forgot-password error", e);
    return NextResponse.json({ error: "Request failed." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid reset data." }, { status: 400 });
    }

    const owner = await prisma.owner.findFirst({
      where: {
        passwordResetToken: parsed.data.token,
        passwordResetExpires: { gt: new Date() },
      },
    });
    if (!owner) {
      return NextResponse.json({ error: "Invalid or expired token." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await prisma.owner.update({
      where: { id: owner.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("reset-password error", e);
    return NextResponse.json({ error: "Reset failed." }, { status: 500 });
  }
}
