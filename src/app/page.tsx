import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/today");
  }
  const ownerExists = (await prisma.owner.count()) > 0;
  redirect(ownerExists ? "/login" : "/register");
}
