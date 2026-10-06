import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const count = await prisma.owner.count();
  return NextResponse.json({ ownerExists: count > 0 });
}
