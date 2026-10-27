"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthCard } from "@/components/AuthCard";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api-client";
import type { MeDto } from "@/lib/types";

export default function SetupPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api<MeDto>("/api/auth/me")
      .then((me) => {
        if (me.user) router.replace("/");
        else if (!me.needsSetup) router.replace("/login");
        else setReady(true);
      })
      .catch(() => setReady(true));
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Logo size={56} />
      </div>
    );
  }
  return <AuthCard mode="setup" />;
}
