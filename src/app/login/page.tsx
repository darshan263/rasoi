"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { AuthCard } from "@/components/AuthCard";
import { api } from "@/lib/api-client";
import type { MeDto } from "@/lib/types";

function Login() {
  const router = useRouter();
  const next = useSearchParams().get("next");

  // Already signed in, or nothing set up yet: this is not the page they need.
  useEffect(() => {
    api<MeDto>("/api/auth/me")
      .then((me) => {
        if (me.needsSetup) router.replace("/setup");
        else if (me.user) router.replace("/");
      })
      .catch(() => {});
  }, [router]);

  return <AuthCard mode="login" next={next} />;
}

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
