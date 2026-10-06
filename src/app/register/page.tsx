"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/owner-status")
      .then((r) => r.json())
      .then((d) => {
        if (d.ownerExists) setLocked(true);
      })
      .catch(() => undefined);
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmPassword, displayName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        if (res.status === 403) setLocked(true);
        return;
      }
      const sign = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (sign?.error) {
        router.replace("/login");
        return;
      }
      router.replace("/today");
      router.refresh();
    });
  }

  if (locked) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
        <div className="panel">
          <h1 className="text-xl font-bold text-brand">Registration closed</h1>
          <p className="mt-2 text-sm text-muted">
            An owner account already exists. Sign in or use Forgot Password.
          </p>
          <Link href="/login" className="btn btn-primary mt-4 w-full">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <div className="panel">
        <p className="brand-mark text-xs font-bold uppercase tracking-[0.18em] text-gold">
          SquareThisUp
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-brand">Create Owner Account</h1>
        <p className="mt-2 text-sm text-muted">
          One-time setup. After this, registration permanently locks.
        </p>

        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <label className="block text-sm font-semibold">
            Email
            <input
              className="field mt-1"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold">
            Display name <span className="font-normal text-muted">(optional)</span>
            <input
              className="field mt-1"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold">
            Password
            <input
              className="field mt-1"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold">
            Confirm password
            <input
              className="field mt-1"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
          <button className="btn btn-primary w-full" disabled={pending} type="submit">
            Create account
          </button>
        </form>

        <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-brand">
          Already have an account? Sign In
        </Link>
      </div>
    </div>
  );
}
