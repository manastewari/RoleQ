"use client";

import { useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  Code2,
  FileText,
  LockKeyhole,
  MessageSquareMore,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { buildWorkspaceFromFiles } from "@/lib/api";
import type { Role, View, Workspace } from "@/lib/types";
import { Badge, Button, Card, ErrorBanner } from "./ui";

function FileDrop({
  number,
  label,
  hint,
  file,
  setFile,
}: {
  number: string;
  label: string;
  hint: string;
  file: File | null;
  setFile: (file: File | null) => void;
}) {
  return (
    <label
      className={`group relative flex min-h-52 cursor-pointer flex-col justify-between overflow-hidden rounded-[24px] border p-5 transition duration-200 ${
        file
          ? "border-emerald-300 bg-emerald-50/70 shadow-[0_12px_35px_rgba(30,110,88,.10)]"
          : "border-dashed border-slate-300 bg-white hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-lg"
      }`}
    >
      <input
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden"
        onChange={(event) => setFile(event.target.files?.[0] || null)}
      />
      <div className="flex items-start justify-between">
        <span className={`grid size-9 place-items-center rounded-xl text-xs font-black ${file ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}>
          {file ? <Check size={16} /> : number}
        </span>
        <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
          PDF · DOCX · TXT
        </span>
      </div>
      <div className="py-6 text-center">
        <div className={`mx-auto grid size-14 place-items-center rounded-2xl transition ${file ? "bg-white text-emerald-700 shadow-sm" : "bg-brand-50 text-brand-700 group-hover:scale-105"}`}>
          {file ? <FileText size={25} /> : <UploadCloud size={25} />}
        </div>
        <div className="mt-4 text-base font-extrabold">{file?.name || label}</div>
        <div className="mx-auto mt-2 max-w-xs text-xs leading-5 text-muted">
          {file ? `${Math.max(1, Math.round(file.size / 1024))} KB · click to replace` : hint}
        </div>
      </div>
      <div className={`h-1 rounded-full ${file ? "bg-emerald-500" : "bg-slate-100"}`} />
    </label>
  );
}

function ReadyScreen({
  workspace,
  onLaunch,
  onReset,
}: {
  workspace: Workspace;
  onLaunch: (target: View) => void;
  onReset: () => void;
}) {
  const profile = workspace.profile.data;
  const config = workspace.assessment.config;
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] bg-[#132f38] p-7 text-white shadow-[0_28px_80px_rgba(15,47,56,.22)] sm:p-10">
        <div className="absolute -right-20 -top-24 size-72 rounded-full bg-emerald-300/15 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 size-64 rounded-full bg-sky-300/10 blur-3xl" />
        <div className="relative grid gap-9 lg:grid-cols-[1fr_340px] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-emerald-300">
              <Check size={14} /> Session prepared
            </div>
            <h1 className="mt-5 max-w-3xl font-serif text-4xl font-bold leading-tight sm:text-5xl">
              Your interview room is ready.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
              We prepared personalized questions for <span className="font-bold text-white">{profile.target_role}</span>.
              Choose a full assessment or jump directly into the live interview.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {profile.priority_topics.slice(0, 5).map((topic) => (
                <span key={topic} className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[10px] font-bold text-white/70">{topic}</span>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.07] p-5 backdrop-blur">
            <div className="text-[10px] font-black uppercase tracking-[.15em] text-white/45">Prepared rounds</div>
            <div className="mt-4 space-y-3">
              {[
                [BookOpenCheck, `${config.mcq_count} knowledge questions`],
                [Code2, `${config.coding_count} coding challenge${config.coding_count === 1 ? "" : "s"}`],
                [MessageSquareMore, `${config.interview_minutes}-minute adaptive interview`],
              ].map(([Icon, label]) => {
                const RoundIcon = Icon as typeof BookOpenCheck;
                return (
                  <div key={String(label)} className="flex items-center gap-3 rounded-2xl bg-black/10 px-4 py-3">
                    <span className="grid size-9 place-items-center rounded-xl bg-emerald-300/10 text-emerald-300"><RoundIcon size={17} /></span>
                    <span className="text-xs font-bold text-white/80">{String(label)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <button
          onClick={() => onLaunch("mcq")}
          className="group relative overflow-hidden rounded-[26px] border border-slate-200 bg-white p-7 text-left shadow-card transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-xl"
        >
          <div className="absolute right-0 top-0 size-40 translate-x-12 -translate-y-12 rounded-full bg-emerald-100/60 blur-2xl" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-emerald-900/15"><BookOpenCheck size={22} /></span>
              <ArrowRight className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand-700" />
            </div>
            <div className="mt-8 text-[10px] font-black uppercase tracking-[.14em] text-brand-700">Recommended complete journey</div>
            <h2 className="mt-2 font-serif text-3xl font-bold">Start full assessment</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted">Begin with MCQs, continue to coding, and finish with the adaptive live interview.</p>
          </div>
        </button>

        <button
          onClick={() => onLaunch("interview")}
          className="group relative overflow-hidden rounded-[26px] border border-slate-700 bg-[#1d2930] p-7 text-left text-white shadow-card transition hover:-translate-y-1 hover:border-emerald-400/50 hover:shadow-xl"
        >
          <div className="absolute right-0 top-0 size-44 translate-x-12 -translate-y-12 rounded-full bg-sky-300/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <span className="grid size-12 place-items-center rounded-2xl bg-emerald-300 text-[#143139] shadow-lg"><MessageSquareMore size={22} /></span>
              <ArrowRight className="text-white/30 transition group-hover:translate-x-1 group-hover:text-emerald-300" />
            </div>
            <div className="mt-8 text-[10px] font-black uppercase tracking-[.14em] text-emerald-300">Conversation practice</div>
            <h2 className="mt-2 font-serif text-3xl font-bold">Start live interview</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/55">Skip straight to Maya’s spoken technical interview and direct easy-DSA coding question.</p>
          </div>
        </button>
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" onClick={onReset}><RotateCcw size={15} /> Use different documents</Button>
      </div>
    </div>
  );
}

export function SetupView({
  role,
  onReady,
}: {
  role: Role;
  onReady: (workspace: Workspace, target?: View) => void;
}) {
  const [resume, setResume] = useState<File | null>(null);
  const [job, setJob] = useState<File | null>(null);
  const [preset, setPreset] = useState<"demo" | "full">("demo");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [prepared, setPrepared] = useState<Workspace | null>(null);

  const create = async () => {
    if (!resume || !job) return;
    setLoading(true);
    setError("");
    setStage("Reading your documents and preparing personalized rounds…");
    try {
      setPrepared(await buildWorkspaceFromFiles(resume, job, role, preset, ""));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not prepare the interview.");
    } finally {
      setLoading(false);
      setStage("");
    }
  };

  if (prepared) {
    return (
      <ReadyScreen
        workspace={prepared}
        onLaunch={(target) => onReady(prepared, target)}
        onReset={() => {
          setPrepared(null);
          setResume(null);
          setJob(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white p-7 shadow-[0_24px_70px_rgba(21,43,52,.08)] sm:p-10">
        <div className="absolute -right-24 -top-24 size-80 rounded-full bg-emerald-100/70 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 size-72 rounded-full bg-sky-100/60 blur-3xl" />
        <div className="relative grid gap-10 lg:grid-cols-[1.12fr_.88fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-emerald-700">
              <Sparkles size={13} /> Personalized interview setup
            </div>
            <h1 className="mt-5 max-w-3xl font-serif text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl">
              Upload two documents.<br />Start practicing.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-muted">
              Add your resume and the job description. RoleQ quietly prepares the relevant knowledge,
              coding, and spoken interview questions—without adding another review step.
            </p>
            <div className="mt-7 flex flex-wrap gap-4 text-xs font-bold text-slate-600">
              <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-brand-600" /> Files discarded after parsing</span>
              <span className="inline-flex items-center gap-2"><LockKeyhole size={16} className="text-brand-600" /> Private by design</span>
            </div>
          </div>
          <div className="rounded-[26px] bg-[#15323b] p-6 text-white shadow-2xl shadow-slate-900/15">
            <div className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-300">How it works</div>
            <div className="mt-5 space-y-5">
              {[
                ["01", "Upload", "Resume and role description"],
                ["02", "Prepare", "Personalized rounds generated"],
                ["03", "Launch", "Assessment or live interview"],
              ].map(([number, title, copy], index) => (
                <div key={number} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="grid size-9 place-items-center rounded-full bg-white/10 text-[10px] font-black text-emerald-300">{number}</span>
                    {index < 2 && <span className="mt-2 h-8 w-px bg-white/10" />}
                  </div>
                  <div className="pt-1">
                    <div className="text-sm font-extrabold">{title}</div>
                    <div className="mt-1 text-[11px] text-white/45">{copy}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error && <ErrorBanner message={error} />}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="text-lg font-extrabold">Add your documents</div>
              <p className="mt-1 text-xs text-muted">Both are required to personalize the session.</p>
            </div>
            <Badge tone={resume && job ? "green" : "neutral"}>{resume && job ? "Ready to prepare" : `${Number(Boolean(resume)) + Number(Boolean(job))}/2 uploaded`}</Badge>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FileDrop number="1" label="Upload your resume" hint="Your skills, projects, coursework, and experience." file={resume} setFile={setResume} />
            <FileDrop number="2" label="Upload job description" hint="The role, requirements, and expected technical stack." file={job} setFile={setJob} />
          </div>
        </Card>

        <Card className="flex flex-col p-6">
          <div>
            <div className="text-lg font-extrabold">Choose session length</div>
            <p className="mt-1 text-xs leading-5 text-muted">You can choose the assessment or interview after preparation.</p>
          </div>
          <div className="mt-5 space-y-3">
            {([
              ["demo", "Quick practice", "5 MCQ · 1 coding · 5 min interview"],
              ["full", "Complete practice", "25 MCQ · 3 coding · 30 min interview"],
            ] as const).map(([value, title, copy]) => (
              <button
                key={value}
                onClick={() => setPreset(value)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  preset === value
                    ? "border-brand-500 bg-brand-50 shadow-sm"
                    : "border-line bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-extrabold">{title}</div>
                  <span className={`size-4 rounded-full border-4 ${preset === value ? "border-brand-600 bg-white" : "border-slate-300"}`} />
                </div>
                <div className="mt-2 text-[11px] leading-5 text-muted">{copy}</div>
              </button>
            ))}
          </div>
          <div className="mt-auto pt-6">
            {stage && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-xs font-bold text-brand-700">
                <span className="size-2 animate-pulse rounded-full bg-brand-500" /> {stage}
              </div>
            )}
            <Button className="min-h-12 w-full text-sm" loading={loading} disabled={!resume || !job} onClick={create}>
              Prepare my session <ArrowRight size={17} />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
