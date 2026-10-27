"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, errorMessage, rememberToken } from "@/lib/api-client";
import { safeNext } from "@/lib/next-path";
import { Logo } from "./Logo";

/** The sign-in and first-run forms: the same fields, different endpoint and wording. */
export function AuthCard({ mode, next }: { mode: "login" | "setup"; next?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setup = mode === "setup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (setup && password !== confirm) return setError("The two passwords do not match");
    setBusy(true);
    try {
      const { token } = await api<{ token: string }>(setup ? "/api/auth/setup" : "/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      rememberToken(token);
      router.replace(setup ? "/" : safeNext(next));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <header className="mb-6 text-center">
          <span className="mb-5 flex justify-center">
            <Logo size={60} />
          </span>
          <h1 className="text-[2rem] leading-tight">{setup ? "Welcome to Rasoi" : "Rasoi"}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {setup
              ? "Create your login. Your ingredient library comes ready with about a thousand ingredients and photos."
              : "Sign in to your recipe book"}
          </p>
        </header>

        <form onSubmit={submit} className="card flex flex-col gap-4 p-6">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={setup ? "new-password" : "current-password"}
              minLength={setup ? 10 : undefined}
              required
            />
            {setup && (
              <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                At least 10 characters.
              </p>
            )}
          </div>
          {setup && (
            <div>
              <label className="label" htmlFor="confirm">
                Password again
              </label>
              <input
                id="confirm"
                type="password"
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          )}

          {error && (
            <p className="text-sm" style={{ color: "var(--debit)" }} role="alert">
              {error}
            </p>
          )}

          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {busy ? (setup ? "Setting up…" : "Signing in…") : setup ? "Create my recipe book" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
