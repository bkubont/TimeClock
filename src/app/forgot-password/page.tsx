"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function requestToken(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Request failed.");
        return;
      }
      setMessage(data.message);
      if (data.token) {
        setIssuedToken(data.token);
        setToken(data.token);
      }
    });
  }

  function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/forgot-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Reset failed.");
        return;
      }
      setMessage("Password updated. You can sign in now.");
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <div className="panel space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-brand">Forgot Password</h1>
          <p className="mt-2 text-sm text-muted">
            Local MVP issues a reset token here (no email transport yet).
          </p>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-success">{message}</p> : null}
        {issuedToken ? (
          <p className="break-all rounded-lg bg-brand-soft p-2 text-xs text-brand">
            Token: {issuedToken}
          </p>
        ) : null}

        <form className="space-y-3" onSubmit={requestToken}>
          <label className="block text-sm font-semibold">
            Email
            <input
              className="field mt-1"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="btn btn-secondary w-full" disabled={pending} type="submit">
            Request reset token
          </button>
        </form>

        <form className="space-y-3" onSubmit={resetPassword}>
          <label className="block text-sm font-semibold">
            Token
            <input
              className="field mt-1"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold">
            New password
            <input
              className="field mt-1"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn btn-primary w-full" disabled={pending} type="submit">
            Update password
          </button>
        </form>

        <Link href="/login" className="inline-block text-sm font-semibold text-brand">
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
