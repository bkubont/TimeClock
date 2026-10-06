import { AppNav } from "@/components/AppNav";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="app-shell">
      <header className="no-print flex items-center justify-between pb-1 pt-4">
        <div>
          <p className="brand-mark text-xs font-bold uppercase tracking-[0.18em] text-gold">
            SquareThisUp
          </p>
          <h1 className="text-lg font-extrabold text-brand">Time Clock</h1>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="btn btn-ghost min-h-10 px-3 text-sm">
            Sign out
          </button>
        </form>
      </header>
      <main className="flex-1">{children}</main>
      <AppNav />
    </div>
  );
}
