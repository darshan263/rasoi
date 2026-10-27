"use client";

import { useState } from "react";

import { signOut } from "@/components/AppShell";
import { IconLogout } from "@/components/Icons";
import { api, errorMessage, rememberToken } from "@/lib/api-client";

export default function SettingsPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmNext, setConfirmNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (next !== confirmNext) return setMessage({ ok: false, text: "The two new passwords do not match" });
    setBusy(true);
    try {
      const { token } = await api<{ token: string }>("/api/auth/password", { method: "POST", body: { current, next } });
      rememberToken(token);
      setCurrent("");
      setNext("");
      setConfirmNext("");
      setMessage({ ok: true, text: "Password changed. Other devices have been signed out." });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <h1 className="text-[1.9rem] leading-tight">Settings</h1>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-xl">Use it like an app</h2>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          <li>
            <strong style={{ color: "var(--text)" }}>Android (Chrome):</strong> open the menu (⋮) and tap{" "}
            <em>Add to Home screen</em> or <em>Install app</em>.
          </li>
          <li>
            <strong style={{ color: "var(--text)" }}>iPhone / iPad (Safari):</strong> tap Share, then{" "}
            <em>Add to Home Screen</em>.
          </li>
          <li>
            <strong style={{ color: "var(--text)" }}>Computer (Chrome / Edge):</strong> click the install icon at the right
            end of the address bar.
          </li>
        </ul>
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Recipes you have opened recently stay readable without internet.
        </p>
      </section>

      <form onSubmit={changePassword} className="card flex flex-col gap-4 p-5">
        <h2 className="text-xl">Change password</h2>
        <div>
          <label className="label" htmlFor="current">
            Current password
          </label>
          <input id="current" type="password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </div>
        <div>
          <label className="label" htmlFor="next">
            New password
          </label>
          <input id="next" type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={10} required />
        </div>
        <div>
          <label className="label" htmlFor="confirm-next">
            New password again
          </label>
          <input id="confirm-next" type="password" className="input" value={confirmNext} onChange={(e) => setConfirmNext(e.target.value)} autoComplete="new-password" required />
        </div>
        {message && (
          <p className="text-sm" style={{ color: message.ok ? "var(--credit)" : "var(--debit)" }} role="status">
            {message.text}
          </p>
        )}
        <button type="submit" className="btn btn-primary self-start" disabled={busy}>
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>

      <button type="button" className="btn btn-secondary self-start" onClick={signOut}>
        <IconLogout size={16} />
        Sign out
      </button>
    </div>
  );
}
