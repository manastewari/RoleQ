"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Clipboard,
  FilePlus2,
  Link2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { AppShell } from "./AppShell";
import { Badge, Button, Card, EmptyState, ErrorBanner } from "./ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { EmployerAssessment, Report, View } from "@/lib/types";

function EmployerSetup({ onCreated }: { onCreated: () => void }) {
  const [job, setJob] = useState<File | null>(null);
  const [preset, setPreset] = useState<"demo" | "full">("demo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    if (!job) return;
    setLoading(true);
    setError("");
    try {
      await api.createEmployerAssessment(job, preset);
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the assessment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">Role and assessment creation</div>
        <h1 className="section-title">Create an employer assessment</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">The job description is parsed in memory. Only canonical role requirements and assessment content are saved.</p>
      </div>
      {error && <ErrorBanner message={error} />}
      <Card className="p-6">
        <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-brand-500">
          <input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(event) => setJob(event.target.files?.[0] || null)} />
          <FilePlus2 size={25} className="text-brand-700" />
          <div className="mt-4 text-sm font-extrabold">{job?.name || "Upload job description"}</div>
          <div className="mt-1 text-xs text-muted">PDF, DOCX, or TXT · maximum 10 MB</div>
        </label>
        <div className="mt-5 grid max-w-md grid-cols-2 gap-3">
          {(["demo", "full"] as const).map((value) => (
            <button key={value} onClick={() => setPreset(value)} className={`rounded-xl border p-4 text-left ${preset === value ? "border-brand-500 bg-brand-50" : "border-line"}`}>
              <div className="text-sm font-extrabold capitalize">{value}</div>
              <div className="mt-1 text-[11px] text-muted">{value === "demo" ? "5 MCQ · 1 code · 5 min" : "25 MCQ · 3 code · 30 min"}</div>
            </button>
          ))}
        </div>
        <Button className="mt-5" disabled={!job} loading={loading} onClick={create}>Create and publish invite <ArrowRight size={15} /></Button>
      </Card>
    </div>
  );
}

function EmployerReport({ report }: { report: Report }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow">Candidate evidence report</div>
        <h1 className="section-title">{report.candidate_name}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{report.disclaimer}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6"><div className="text-sm font-extrabold text-emerald-700">Evidence-backed strengths</div><ul className="mt-4 space-y-2 text-xs leading-6 text-muted">{report.strengths.map((item) => <li key={item}>• {item}</li>)}</ul></Card>
        <Card className="p-6"><div className="text-sm font-extrabold text-amber-700">Development gaps</div><ul className="mt-4 space-y-2 text-xs leading-6 text-muted">{report.gaps.map((item) => <li key={item}>• {item}</li>)}</ul></Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {report.dimensions.map((dimension) => (
          <Card key={dimension.name} className="p-6">
            <div className="flex items-center justify-between gap-3"><div className="text-sm font-extrabold">{dimension.name}</div><Badge>{dimension.status}</Badge></div>
            <ul className="mt-4 space-y-2 text-xs leading-5 text-muted">{dimension.evidence.map((item) => <li key={item}>• {item}</li>)}</ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function EmployerApp() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>("employer");
  const [assessments, setAssessments] = useState<EmployerAssessment[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = () => {
    setLoading(true);
    api.listEmployerAssessments()
      .then(setAssessments)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load assessments."))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);
  if (!user) return null;

  const openReport = async (attemptId: string) => {
    setError("");
    try {
      setReport(await api.report(attemptId, "employer"));
      setView("report");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load candidate evidence.");
    }
  };

  let content;
  if (view === "employer_setup") {
    content = <EmployerSetup onCreated={() => { refresh(); setView("employer"); }} />;
  } else if (view === "report") {
    content = report ? <EmployerReport report={report} /> : (
      <EmptyState icon={<BarChart3 />} title="Select a candidate report" description="Open a candidate from the hiring dashboard to review separate evidence dimensions." />
    );
  } else {
    content = (
      <div className="space-y-6">
        <Card className="soft-grid p-8 sm:p-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="eyebrow">Hiring dashboard</div>
              <h1 className="section-title max-w-3xl">Role-specific evidence with a human in the loop.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">Create an assessment, share its invite code, and review knowledge, coding, interview, and integrity evidence separately.</p>
            </div>
            <Button onClick={() => setView("employer_setup")}><FilePlus2 size={16} /> Create assessment</Button>
          </div>
        </Card>
        {error && <ErrorBanner message={error} />}
        {loading ? <Card className="p-8 text-sm text-muted">Loading hiring workspace…</Card> : assessments.length === 0 ? (
          <EmptyState icon={<ShieldCheck />} title="No assessments yet" description="Upload a job description to create your first role profile and candidate invite." action={<Button onClick={() => setView("employer_setup")}>Create assessment</Button>} />
        ) : assessments.map((assessment) => (
          <Card key={assessment.id} className="overflow-hidden">
            <div className="flex flex-col justify-between gap-4 border-b border-line px-6 py-5 sm:flex-row sm:items-center">
              <div>
                <div className="text-lg font-extrabold">{assessment.data.title}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted"><Link2 size={13} /> Invite <span className="font-mono font-black tracking-wider text-ink">{assessment.invite_code}</span></div>
              </div>
              <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(assessment.invite_code || "")}><Clipboard size={15} /> Copy invite</Button>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-center gap-2 text-sm font-extrabold"><UsersRound size={17} className="text-brand-700" /> Candidate pipeline</div>
              {assessment.attempts?.length ? (
                <div className="mt-4 divide-y divide-line rounded-xl border border-line">
                  {assessment.attempts.map((attempt) => (
                    <div key={attempt.id} className="flex flex-col justify-between gap-3 px-4 py-4 sm:flex-row sm:items-center">
                      <div><div className="text-sm font-extrabold">{attempt.candidate_name}</div><div className="mt-1 text-[11px] text-muted">{attempt.status.replace("_", " ")}</div></div>
                      <Button variant="ghost" onClick={() => openReport(attempt.id)}>Review evidence <ArrowRight size={14} /></Button>
                    </div>
                  ))}
                </div>
              ) : <div className="mt-4 rounded-xl bg-slate-50 px-4 py-5 text-xs text-muted">No candidate has joined this invite yet.</div>}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return <AppShell accountRole="employer" user={user} view={view} setView={setView} logout={logout}>{content}</AppShell>;
}
