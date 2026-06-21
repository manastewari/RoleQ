"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { Card } from "@/components/ui";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { completeSession } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const finish = async () => {
      try {
        const supabase = getSupabase();
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session || !data.session.user.email_confirmed_at) {
          throw new Error("The email verification link is invalid or has expired.");
        }
        const user = await completeSession(data.session.access_token);
        if (active) router.replace(`/${user.role}`);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Could not verify this account.");
      }
    };
    void finish();
    return () => { active = false; };
  }, [completeSession, router]);

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <Card className="w-full max-w-md p-8 text-center">
        {error ? (
          <>
            <div className="text-sm font-extrabold text-rose-700">Verification failed</div>
            <p className="mt-3 text-sm leading-6 text-muted">{error}</p>
            <Link className="mt-6 inline-block text-sm font-extrabold text-brand-700" href="/login">Return to login</Link>
          </>
        ) : (
          <>
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="hidden" />
              <LoaderCircle className="animate-spin" />
            </div>
            <div className="mt-5 text-lg font-extrabold">Verifying your email</div>
            <p className="mt-2 text-sm text-muted">Creating your secure RoleQ workspace…</p>
          </>
        )}
      </Card>
    </main>
  );
}
