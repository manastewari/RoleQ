"use client";

import {
  BarChart3,
  BriefcaseBusiness,
  ChevronDown,
  Gauge,
  House,
  LogOut,
  MessageSquareMore,
  PlusCircle,
  ShieldCheck,
  UserRoundSearch,
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AccountRole, User, View, Workspace } from "@/lib/types";
import { RoleQMark } from "./RoleQLogo";

const studentNav: { id: View; label: string; icon: typeof Gauge }[] = [
  { id: "dashboard", label: "Home", icon: House },
  { id: "intelligence", label: "Resume Intelligence", icon: UserRoundSearch },
  { id: "setup", label: "AI Interview", icon: MessageSquareMore },
];

const employerNav: { id: View; label: string; icon: typeof Gauge }[] = [
  { id: "employer", label: "Hiring dashboard", icon: BriefcaseBusiness },
  { id: "employer_setup", label: "Role and assessment creation", icon: PlusCircle },
  { id: "employer_invites", label: "Invite management", icon: MessageSquareMore },
  { id: "employer_pipeline", label: "Candidate pipeline", icon: UserRoundSearch },
  { id: "report", label: "Candidate evidence", icon: ShieldCheck },
];

export function AppShell({
  children,
  accountRole,
  user,
  view,
  setView,
  workspace,
  logout,
}: {
  children: ReactNode;
  accountRole: AccountRole;
  user: User;
  view: View;
  setView: (view: View) => void;
  workspace?: Workspace | null;
  logout: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const initials = user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  useEffect(() => {
    const closeProfile = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", closeProfile);
    return () => document.removeEventListener("mousedown", closeProfile);
  }, []);

  if (accountRole === "student") {
    const interviewActive = ["setup", "mcq", "coding", "interview", "report"].includes(view);
    return (
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-line/80 bg-white/90 shadow-[0_8px_30px_rgba(23,32,51,.05)] backdrop-blur-xl">
          <div className="flex w-full items-center gap-3 px-4 py-3 sm:px-6 md:grid md:grid-cols-[1fr_auto_1fr] lg:px-8">
            <button
              type="button"
              onClick={() => setView("dashboard")}
              className="flex shrink-0 items-center gap-3 rounded-xl text-left md:justify-self-start"
              aria-label="Go to dashboard"
            >
              <div className="grid size-10 place-items-center rounded-xl bg-[#17343d] text-white shadow-sm">
                <RoleQMark className="size-7" />
              </div>
              <div className="hidden sm:block">
                <div className="font-serif text-xl font-bold leading-none tracking-tight">RoleQ</div>
                <div className="mt-1 text-[8px] font-black uppercase tracking-[.18em] text-muted">
                  Measure. Practice. Succeed.
                </div>
              </div>
            </button>

            <nav className="ml-auto flex min-w-0 items-center gap-1 rounded-2xl border border-line/80 bg-[#f7f9fb] p-1 md:ml-0 md:justify-self-center">
              {studentNav.map((item) => {
                const Icon = item.icon;
                const active = item.id === "setup" ? interviewActive : view === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setView(item.id)}
                    className={clsx(
                      "flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition sm:px-4",
                      active
                        ? "bg-white text-brand-700 shadow-sm ring-1 ring-black/5"
                        : "text-muted hover:bg-white/70 hover:text-ink",
                    )}
                  >
                    <Icon size={16} />
                    <span className={clsx(item.id === "intelligence" && "hidden md:inline", item.id !== "intelligence" && "hidden min-[520px]:inline")}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div ref={profileRef} className="relative ml-1 shrink-0 md:ml-0 md:justify-self-end">
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                className={clsx(
                  "flex items-center gap-2 rounded-full border bg-white p-1.5 pr-2 transition hover:border-brand-700/35 hover:shadow-md sm:gap-3 sm:pr-3",
                  view === "performance" ? "border-brand-700/35 ring-4 ring-brand-100/70" : "border-line shadow-sm",
                )}
              >
                <div className="grid size-8 place-items-center rounded-full bg-brand-100 text-xs font-black text-brand-700 sm:size-9">
                  {initials || "U"}
                </div>
                <div className="hidden text-left lg:block">
                  <div className="max-w-32 truncate text-xs font-extrabold">{user.name}</div>
                  <div className="text-[10px] text-muted">Student profile</div>
                </div>
                <ChevronDown
                  size={14}
                  className={clsx("hidden text-muted transition sm:block", profileOpen && "rotate-180")}
                />
              </button>

              {profileOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+10px)] w-64 overflow-hidden rounded-2xl border border-line bg-white p-2 shadow-[0_22px_60px_rgba(23,32,51,.18)]"
                >
                  <div className="border-b border-line px-3 py-3">
                    <div className="truncate text-sm font-extrabold">{user.name}</div>
                    <div className="mt-0.5 truncate text-xs text-muted">{user.email}</div>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setView("performance");
                      setProfileOpen(false);
                    }}
                    className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-ink transition hover:bg-brand-100/70 hover:text-brand-700"
                  >
                    <BarChart3 size={17} /> My performance
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={logout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-muted transition hover:bg-rose-50 hover:text-rose-700"
                  >
                    <LogOut size={17} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="px-4 pb-14 pt-7 sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-[1240px]">
            <div className="mb-7">
              <div className="text-xs font-bold uppercase tracking-[.13em] text-muted">
                Student preparation workspace
              </div>
              <div className="mt-1 text-sm font-semibold text-ink">
                {workspace?.assessment.data.title || "Build evidence, practice deliberately, and improve"}
              </div>
            </div>
            <div className="fade-up">{children}</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-grid">
      <aside className="sidebar">
        <div className="flex items-center gap-3 px-2">
          <div className="grid size-10 place-items-center rounded-xl bg-white text-brand-700">
            <RoleQMark className="size-7" />
          </div>
          <div>
            <div className="font-serif text-xl font-bold tracking-tight">RoleQ</div>
            <div className="text-[10px] font-bold uppercase tracking-[.18em] text-white/55">Measure. Practice. Succeed.</div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[.15em] text-white/45">Account</div>
          <div className="mt-1 text-sm font-extrabold capitalize">{accountRole}</div>
          <div className="mt-0.5 truncate text-[11px] text-white/50">{user.email}</div>
        </div>

        <nav className="mt-7 space-y-1.5">
          {employerNav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition",
                  view === item.id ? "bg-white/12 text-white" : "text-white/60 hover:bg-white/7 hover:text-white",
                )}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <button
          onClick={logout}
          className="absolute bottom-6 left-5 right-5 flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/7 hover:text-white"
        >
          <LogOut size={17} /> Sign out
        </button>
      </aside>
      <main className="content-area">
        <div className="page-shell">
          <header className="mb-7 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[.13em] text-muted">
                Employer hiring workspace
              </div>
              <div className="mt-1 text-sm font-semibold text-ink">
                {workspace?.assessment.data.title || "Create role-specific assessments and review evidence"}
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-line bg-white px-3 py-2 shadow-sm">
              <div className="grid size-8 place-items-center rounded-full bg-brand-100 text-xs font-black text-brand-700">
                {initials || "U"}
              </div>
              <div className="hidden pr-1 sm:block">
                <div className="text-xs font-extrabold">{user.name}</div>
                <div className="text-[10px] capitalize text-muted">{accountRole}</div>
              </div>
            </div>
          </header>
          <div className="fade-up">{children}</div>
        </div>
      </main>
    </div>
  );
}
