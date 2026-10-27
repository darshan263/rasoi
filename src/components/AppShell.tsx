"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, forgetToken } from "@/lib/api-client";
import type { MeDto } from "@/lib/types";
import { IconBasket, IconBook, IconLogout, IconPlus, IconSettings } from "./Icons";
import { Logo } from "./Logo";

const NAV = [
  { href: "/", label: "Recipes", Icon: IconBook },
  { href: "/ingredients", label: "Ingredients", Icon: IconBasket },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

/** Sign out here and forget what this device cached, so the next person sees nothing. */
export async function signOut() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    // Signed out locally either way.
  }
  forgetToken();
  try {
    for (const key of await caches.keys()) if (key.startsWith("rasoi-data")) await caches.delete(key);
  } catch {}
  window.location.href = "/login";
}

/**
 * The signed-in frame: a sidebar on a wide screen, a top bar and bottom tabs on a phone.
 *
 * It also checks the session before showing anything. The API enforces sign-in on every
 * request regardless; this only decides between showing the app, the sign-in page and the
 * first-run setup. Done in the browser rather than in middleware so the UI can be exported as
 * static files for a native shell.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeDto | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<MeDto>("/api/auth/me")
      .then((result) => {
        if (cancelled) return;
        if (result.needsSetup) router.replace("/setup");
        else if (!result.user) {
          const back = window.location.pathname + window.location.search;
          router.replace(back === "/" ? "/login" : `/login?next=${encodeURIComponent(back)}`);
        } else setMe(result);
      })
      .catch(() => {
        // Offline: show the app anyway; cached recipes still open (see public/sw.js).
        if (!cancelled) setMe({ user: null, needsSetup: false });
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Logo size={56} />
      </div>
    );
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/recipe") : pathname.startsWith(href);

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print hidden w-64 shrink-0 border-r lg:block" style={{ background: "var(--bg-sidebar)" }}>
        <div className="sticky top-0 flex h-screen flex-col gap-6 p-5">
          <Link href="/" className="flex items-center gap-3 px-1">
            <Logo size={40} />
            <span>
              <span className="figure block text-xl leading-tight">Rasoi</span>
              <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
                Recipe book
              </span>
            </span>
          </Link>

          <Link href="/recipe/edit" className="btn btn-primary w-full">
            <IconPlus size={16} />
            New recipe
          </Link>

          <nav className="flex flex-col gap-0.5">
            {NAV.map(({ href, label, Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-full px-3.5 py-2 text-sm transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    background: active ? "var(--bg-elevated)" : undefined,
                    color: active ? "var(--text)" : "var(--text-muted)",
                    fontWeight: active ? 600 : 500,
                    boxShadow: active ? "var(--shadow-sm)" : undefined,
                  }}
                >
                  <Icon size={17} style={{ color: active ? "var(--accent)" : undefined }} />
                  <span className="flex-1">{label}</span>
                  {active && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--warm)" }} />}
                </Link>
              );
            })}
          </nav>

          {me.user && (
            <div className="mt-auto flex items-center gap-2.5 rounded-2xl border p-2" style={{ background: "var(--bg-elevated)" }}>
              <span className="min-w-0 flex-1 px-1">
                <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
                  Signed in as
                </span>
                <span className="block truncate text-sm font-medium">{me.user.email}</span>
              </span>
              <button className="btn btn-ghost btn-sm" title="Sign out" type="button" onClick={signOut}>
                <IconLogout size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <header
        className="no-print sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-2.5 lg:hidden"
        style={{ background: "color-mix(in srgb, var(--bg-sidebar) 92%, transparent)", backdropFilter: "blur(8px)" }}
      >
        <Link href="/" className="flex flex-1 items-center gap-2.5">
          <Logo size={30} />
          <span className="figure text-lg">Rasoi</span>
        </Link>
        <Link href="/recipe/edit" className="btn btn-primary btn-sm">
          <IconPlus size={15} />
          New
        </Link>
      </header>

      <main className="min-w-0 flex-1 pb-24 lg:pb-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>

      <nav
        className="no-print pb-safe fixed inset-x-0 bottom-0 z-30 border-t lg:hidden"
        style={{ background: "color-mix(in srgb, var(--bg-sidebar) 95%, transparent)", backdropFilter: "blur(8px)" }}
      >
        <div className="flex">
          {NAV.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold"
                style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
              >
                <Icon size={22} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
