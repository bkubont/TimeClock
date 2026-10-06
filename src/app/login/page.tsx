"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ownerExists, setOwnerExists] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/owner-status")
      .then((r) => r.json())
      .then((d) => setOwnerExists(!!d.ownerExists))
      .catch(() => setOwnerExists(true));
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password.");
        return;
      }
      router.replace("/today");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <div className="panel">
        <p className="brand-mark text-xs font-bold uppercase tracking-[0.18em] text-gold">
          SquareThisUp
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-brand">Time Clock</h1>
        <p className="mt-2 text-sm text-muted">Sign in to your private workday clock.</p>

        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <label className="block text-sm font-semibold">
            Email
            <input
              className="field mt-1"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold">
            Password
            <input
              className="field mt-1"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn btn-primary w-full" disabled={pending} type="submit">
            Sign In
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-2 text-sm">
          <Link href="/forgot-password" className="font-semibold text-brand">
            Forgot Password
          </Link>
          {ownerExists === false ? (
            <Link href="/register" className="font-semibold text-brand">
              Create Owner Account
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
