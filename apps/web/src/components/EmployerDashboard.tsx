"use client";

import { ArrowRight, Clipboard, FilePlus2, Link2, MoreHorizontal, ShieldCheck, UsersRound } from "lucide-react";
import type { Workspace } from "@/lib/types";
import { Badge, Button, Card } from "./ui";

export function EmployerDashboard({
  workspace,
  loading,
  loadDemo,
  createCustom,
  openReport,
}: {
  workspace: Workspace | null;
  loading: boolean;
  loadDemo: () => void;
  createCustom: () => void;
  openReport: () => void;
}) {
  if (!workspace) {
    return (
      <div className="space-y-6">
        <Card className="soft-grid p-8 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <div className="eyebrow">Employer assessment mode</div>
              <h1 className="section-title max-w-2xl">Review evidence without pretending AI is a hiring oracle.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
                Configure role-specific rounds, invite candidates, inspect source-linked answers, and keep consequential decisions with a human reviewer.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button loading={loading} onClick={loadDemo}>Open employer demo <ArrowRight size={16} /></Button>
                <Button variant="secondary" onClick={createCustom}><FilePlus2 size={16} /> Build from documents</Button>
              </div>
            </div>
            <div className="rounded-3xl bg-[#17333b] p-6 text-white shadow-2xl">
              <ShieldCheck size={28} className="text-emerald-300" />
              <div className="mt-12 text-2xl font-serif font-bold">Human review stays in the loop.</div>
              <p className="mt-3 text-xs leading-6 text-white/55">No automatic rejection. No emotion inference. No guilt score.</p>
            </div>
          </div>
        </Card>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["01", "Create a role blueprint", "Upload a job description and choose safe round limits."],
            ["02", "Invite a candidate", "Share a short code; the candidate adds their resume."],
            ["03", "Review raw dimensions", "Inspect knowledge, code, conversation, and integrity separately."],
          ].map(([number, title, copy]) => (
            <Card key={number} className="p-6">
              <div className="font-serif text-3xl font-bold text-brand-600">{number}</div>
              <h3 className="mt-5 text-sm font-extrabold">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-muted">{copy}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">Hiring workspace</div>
          <h1 className="section-title">Junior Backend Engineer</h1>
          <p className="mt-3 text-sm text-muted">One candidate · personalized technical assessment · human review required</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(workspace.assessment.invite_code || "")}>
            <Clipboard size={15} /> Copy invite
          </Button>
          <Button onClick={openReport}>Open evidence <ArrowRight size={16} /></Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between"><div className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Link2 size={18} /></div><Badge tone="green">published</Badge></div>
          <div className="mt-5 text-xs font-bold text-muted">Invite code</div>
          <div className="mt-1 font-mono text-2xl font-black tracking-[.16em]">{workspace.assessment.invite_code || "DEMO01"}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between"><div className="grid size-10 place-items-center rounded-xl bg-sky-50 text-sky-700"><UsersRound size={18} /></div><Badge>beta</Badge></div>
          <div className="mt-5 text-xs font-bold text-muted">Candidates</div>
          <div className="mt-1 text-2xl font-black">1 active</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between"><div className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><ShieldCheck size={18} /></div><Badge tone="amber">review only</Badge></div>
          <div className="mt-5 text-xs font-bold text-muted">Decision policy</div>
          <div className="mt-1 text-lg font-black">Human reviewer</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-6 py-4"><h2 className="text-sm font-extrabold">Candidate pipeline</h2><button className="text-muted"><MoreHorizontal size={19} /></button></div>
        <div className="grid gap-4 px-6 py-5 md:grid-cols-[1.2fr_.8fr_.8fr_.8fr_auto] md:items-center">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-brand-100 text-xs font-black text-brand-700">AM</div>
            <div><div className="text-sm font-extrabold">Alex Morgan</div><div className="text-[11px] text-muted">alex@example.test</div></div>
          </div>
          <div><div className="text-[10px] font-bold uppercase text-muted">Knowledge</div><div className="mt-1 text-xs font-bold">Awaiting evidence</div></div>
          <div><div className="text-[10px] font-bold uppercase text-muted">Coding</div><div className="mt-1 text-xs font-bold">Awaiting evidence</div></div>
          <div><div className="text-[10px] font-bold uppercase text-muted">Interview</div><div className="mt-1 text-xs font-bold">In progress</div></div>
          <Button variant="ghost" onClick={openReport}>Review</Button>
        </div>
      </Card>
    </div>
  );
}

