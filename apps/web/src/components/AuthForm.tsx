"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BriefcaseBusiness, GraduationCap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import type { AccountRole } from "@/lib/types";
import { Button, ErrorBanner } from "./ui";
import { RoleQMark } from "./RoleQLogo";

type SupabaseAuthErrorLike = {
  message?: unknown;
  code?: unknown;
  status?: unknown;
};

function authErrorMessage(error: unknown, action: "signup" | "login" | "resend"): string {
  const value = (error && typeof error === "object" ? error : {}) as SupabaseAuthErrorLike;
  const code = typeof value.code === "string" ? value.code.toLowerCase() : "";
  const rawMessage = typeof value.message === "string" ? value.message.trim() : "";
  const normalized = rawMessage.toLowerCase();

  if (
    code.includes("over_email_send_rate_limit")
    || normalized.includes("email rate limit")
    || normalized.includes("rate limit exceeded")
  ) {
    return "Verification email delivery is unavailable. The project owner needs to configure custom SMTP in Supabase before public signups can receive email.";
  }
  if (
    code.includes("email_address_not_authorized")
    || normalized.includes("email address not authorized")
    || normalized.includes("not authorized to send")
  ) {
    return "This project is still using Supabase's restricted demo email service. Public signup requires custom SMTP configuration.";
  }
  if (code.includes("email_address_invalid") || normalized.includes("invalid email")) {
    return "Enter a valid email address that can receive the verification message.";
  }
  if (code.includes("user_already_exists") || normalized.includes("already registered")) {
    return "An account already exists for this email. Sign in, or resend confirmation if it is still unverified.";
  }
  if (code.includes("email_not_confirmed") || normalized.includes("email not confirmed")) {
    return "Confirm this email using the link in your inbox before signing in.";
  }
  if (code.includes("invalid_credentials") || normalized.includes("invalid login credentials")) {
    return "The email or password is incorrect.";
  }
  if (code.includes("weak_password")) {
    return rawMessage && rawMessage !== "{}" ? rawMessage : "Choose a stronger password and try again.";
  }
  if (code.includes("signup_disabled")) {
    return "New account registration is currently disabled in Supabase.";
  }
  if (
    rawMessage === "{}"
    || !rawMessage
    || normalized.includes("error sending confirmation")
    || normalized.includes("failed to send")
    || Number(value.status) >= 500
  ) {
    return action === "login"
      ? "Supabase could not complete sign-in. Please try again shortly."
      : "Supabase could not send the verification email. Public signup requires custom SMTP in the Supabase project.";
  }
  return rawMessage;
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const router = useRouter();
  const search = useSearchParams();
  const { completeSession } = useAuth();
  const hintedRole = search.get("role");
  const [role, setRole] = useState<AccountRole>(hintedRole === "employer" ? "employer" : "student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const supabase = getSupabase();
      if (mode === "signup") {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              full_name: name.trim(),
              account_role: role,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signupError) throw signupError;
        if (data.session) {
          await supabase.auth.signOut();
          throw new Error(
            "Email confirmation is disabled in Supabase. Enable Confirm email before accepting registrations.",
          );
        }
        setConfirmationSent(true);
        return;
      }

      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (loginError) throw loginError;
      if (!data.session || !data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        throw new Error("Confirm this email from your inbox before signing in.");
      }
      const applicationUser = await completeSession(data.session.access_token);
      const next = search.get("next");
      router.replace(next?.startsWith("/") ? next : `/${applicationUser.role}`);
    } catch (caught) {
      setError(authErrorMessage(caught, mode));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-[.9fr_1.1fr]">
      <section className="hidden bg-[#17333b] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-white text-brand-700"><RoleQMark className="size-7" /></span>
          <span>
            <span className="block font-serif text-xl font-bold leading-none">RoleQ</span>
            <span className="mt-1 block text-[8px] font-black uppercase tracking-[.16em] text-white/45">Measure. Practice. Succeed.</span>
          </span>
        </Link>
        <div>
          <div className="font-serif text-5xl font-bold leading-tight">A better interview starts before the call.</div>
          <p className="mt-5 max-w-lg text-sm leading-7 text-white/55">Build role-specific practice and review evidence without pretending AI can make consequential decisions for people.</p>
        </div>
        <div className="text-xs text-white/35">Private by design · original questions · human review</div>
      </section>
      <section className="grid place-items-center px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-md">
          <div className="eyebrow">{mode === "signup" ? "Create your account" : "Welcome back"}</div>
          <h1 className="mt-3 font-serif text-4xl font-bold">{mode === "signup" ? "Choose your workspace." : "Sign in to RoleQ."}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            {mode === "signup" ? "Your account type is fixed after registration." : "Your saved account role determines where you go next."}
          </p>

          {error && <div className="mt-6"><ErrorBanner message={error} /></div>}
          {!supabaseConfigured && (
            <div className="mt-6">
              <ErrorBanner message="Supabase Auth needs configuration. Add the project URL and publishable key to .env, then restart the app." />
            </div>
          )}
          {confirmationSent && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
              <div className="font-extrabold">Check your inbox</div>
              <p className="mt-1">We sent a verification link to {email}. The account cannot sign in until that email is confirmed.</p>
              <button
                type="button"
                className="mt-3 text-xs font-extrabold underline"
                onClick={async () => {
                  const { error: resendError } = await getSupabase().auth.resend({
                    type: "signup",
                    email: email.trim().toLowerCase(),
                    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
                  });
                  if (resendError) setError(authErrorMessage(resendError, "resend"));
                }}
              >
                Resend verification email
              </button>
            </div>
          )}

          {mode === "signup" && !confirmationSent && (
            <>
              <div className="mt-7 grid grid-cols-2 gap-3">
                {([
                  ["student", GraduationCap, "Practice and improve"],
                  ["employer", BriefcaseBusiness, "Create and review"],
                ] as const).map(([value, Icon, copy]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setRole(value)}
                    className={`rounded-2xl border p-4 text-left transition ${role === value ? "border-brand-500 bg-brand-50" : "border-line bg-white"}`}
                  >
                    <Icon size={19} className="text-brand-700" />
                    <div className="mt-4 text-sm font-extrabold capitalize">{value}</div>
                    <div className="mt-1 text-[11px] text-muted">{copy}</div>
                  </button>
                ))}
              </div>
              <label className="mt-6 block text-xs font-bold text-muted">Full name</label>
              <input className="form-control mt-2" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
            </>
          )}
          {!confirmationSent && (
            <>
              <label className="mt-5 block text-xs font-bold text-muted">Email</label>
              <input className="form-control mt-2" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <label className="mt-5 block text-xs font-bold text-muted">Password</label>
              <input className="form-control mt-2" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
              <Button className="mt-7 w-full" loading={loading} disabled={!supabaseConfigured} type="submit">
                {mode === "signup" ? "Create account and verify email" : "Sign in"}
              </Button>
            </>
          )}
          <p className="mt-5 text-center text-xs text-muted">
            {mode === "signup" ? "Already have an account?" : "New to RoleQ?"}{" "}
            <Link className="font-extrabold text-brand-700" href={mode === "signup" ? "/login" : "/signup"}>
              {mode === "signup" ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
