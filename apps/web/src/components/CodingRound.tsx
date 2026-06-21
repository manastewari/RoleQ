"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Braces, CheckCircle2, Clock3, Code2, Play, Send, TerminalSquare, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { CodeRunResult, CodingProblem, Workspace } from "@/lib/types";
import { Badge, Button, ErrorBanner } from "./ui";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="grid h-[440px] place-items-center bg-[#101722] text-xs text-white/50">Loading editor…</div>,
});

const languageLabels: Record<string, string> = {
  python: "Python",
  java: "Java",
  javascript: "JavaScript",
  typescript: "TypeScript",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  go: "Go",
};

const monacoLanguage: Record<string, string> = {
  python: "python",
  java: "java",
  javascript: "javascript",
  typescript: "typescript",
  c: "c",
  cpp: "cpp",
  csharp: "csharp",
  go: "go",
};

export function CodingRound({
  workspace,
  onContinue,
  interviewProblems = false,
  preferredProblemIds,
  initialLanguage = "python",
  onProblemPresented,
}: {
  workspace: Workspace;
  onContinue?: () => void;
  interviewProblems?: boolean;
  preferredProblemIds?: string[];
  initialLanguage?: string;
  onProblemPresented?: (problem: CodingProblem) => void;
}) {
  const [problems, setProblems] = useState<CodingProblem[]>(workspace.assessment.data.coding_problems);
  const [problemIndex, setProblemIndex] = useState(0);
  const [language, setLanguage] = useState(initialLanguage);
  const [source, setSource] = useState("");
  const [result, setResult] = useState<CodeRunResult | null>(null);
  const [loading, setLoading] = useState<"run" | "submit" | null>(null);
  const [error, setError] = useState("");
  const problem = problems[problemIndex];

  useEffect(() => {
    if (interviewProblems) {
      api.listProblems()
        .then((items) => setProblems(preferredProblemIds?.length ? items.filter((item) => preferredProblemIds.includes(item.id)) : items.slice(0, 2)))
        .catch(() => undefined);
    }
  }, [interviewProblems, preferredProblemIds]);

  useEffect(() => {
    if (problem) {
      setSource(problem.starter_code[language] || "");
      setResult(null);
    }
  }, [problem, language]);

  useEffect(() => {
    if (interviewProblems && problem) onProblemPresented?.(problem);
  }, [interviewProblems, onProblemPresented, problem]);

  const run = async (submit: boolean) => {
    if (!problem) return;
    setLoading(submit ? "submit" : "run");
    setError("");
    try {
      setResult(await api.runCode(workspace.attempt.id, problem.id, language, source, submit));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Code execution failed.");
    } finally {
      setLoading(null);
    }
  };

  const passed = useMemo(() => result && result.passed_count === result.total_count, [result]);
  if (!problem) return null;

  return (
    <div className="space-y-5">
      {!interviewProblems && (
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="eyebrow">Round two</div>
            <h1 className="section-title">Coding studio</h1>
            <p className="mt-3 text-sm text-muted">Public tests guide iteration. Final submission runs hidden tests.</p>
          </div>
          {onContinue && <Button onClick={onContinue}>Continue to interview <ArrowRight size={16} /></Button>}
        </div>
      )}
      {error && <ErrorBanner message={error} />}
      <div className="grid min-h-[720px] overflow-hidden rounded-2xl border border-line bg-white shadow-card lg:grid-cols-[420px_minmax(0,1fr)]">
        <section className="overflow-y-auto border-b border-line p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Badge tone={problem.difficulty === "easy" ? "green" : "amber"}>{problem.difficulty}</Badge>
              {problem.tags.slice(0, 2).map((tag) => <Badge key={tag}>{tag}</Badge>)}
            </div>
            <span className="text-xs font-black text-muted">{problemIndex + 1}/{problems.length}</span>
          </div>
          <h2 className="mt-5 font-serif text-3xl font-bold tracking-tight">{problem.title}</h2>
          <p className="mt-4 text-sm leading-7 text-slate-700">{problem.statement}</p>
          <div className="mt-6 space-y-5 text-sm">
            <div><div className="text-xs font-black uppercase tracking-wide text-muted">Input</div><p className="mt-1.5 leading-6">{problem.input_format}</p></div>
            <div><div className="text-xs font-black uppercase tracking-wide text-muted">Output</div><p className="mt-1.5 leading-6">{problem.output_format}</p></div>
            <div>
              <div className="text-xs font-black uppercase tracking-wide text-muted">Constraints</div>
              <ul className="mt-2 space-y-1.5">{problem.constraints.map((item) => <li key={item} className="font-mono text-xs">• {item}</li>)}</ul>
            </div>
            {problem.examples.map((example, index) => (
              <div key={index}>
                <div className="text-xs font-black uppercase tracking-wide text-muted">Example {index + 1}</div>
                <div className="mt-2 overflow-hidden rounded-xl bg-slate-950 font-mono text-xs text-slate-200">
                  <div className="border-b border-white/10 px-4 py-2 text-white/45">input</div>
                  <pre className="whitespace-pre-wrap px-4 py-3">{example.input}</pre>
                  <div className="border-y border-white/10 px-4 py-2 text-white/45">output</div>
                  <pre className="whitespace-pre-wrap px-4 py-3">{example.expected_output}</pre>
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
              <div className="flex items-center gap-2 text-xs font-black text-brand-700"><Clock3 size={15} /> Expected complexity</div>
              <p className="mt-1.5 text-xs leading-5 text-brand-700/80">{problem.expected_complexity}</p>
            </div>
          </div>
          {problems.length > 1 && (
            <div className="mt-6 flex gap-2">
              {problems.map((item, index) => (
                <button key={item.id} onClick={() => setProblemIndex(index)} className={`h-2 flex-1 rounded-full ${index === problemIndex ? "bg-brand-600" : "bg-slate-200"}`} aria-label={`Open ${item.title}`} />
              ))}
            </div>
          )}
        </section>

        <section className="flex min-w-0 flex-col bg-[#101722]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white/70"><Code2 size={16} /> main</div>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white outline-none"
            >
              {Object.entries(languageLabels).map(([value, label]) => <option key={value} value={value} className="text-black">{label}</option>)}
            </select>
          </div>
          <Editor
            height="440px"
            theme="vs-dark"
            language={monacoLanguage[language]}
            value={source}
            onChange={(value) => setSource(value || "")}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineHeight: 22,
              padding: { top: 18 },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
            }}
          />
          <div className="flex items-center justify-between gap-3 border-y border-white/10 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white/55"><TerminalSquare size={15} /> Test console</div>
            <div className="flex gap-2">
              <Button variant="secondary" loading={loading === "run"} onClick={() => run(false)}><Play size={15} /> Run</Button>
              <Button loading={loading === "submit"} onClick={() => run(true)}><Send size={15} /> Submit</Button>
            </div>
          </div>
          <div className="min-h-44 flex-1 overflow-y-auto bg-[#0b111a] p-4">
            {!result ? (
              <div className="flex h-full min-h-36 flex-col items-center justify-center text-center text-white/30">
                <Braces size={26} />
                <p className="mt-2 text-xs">Run your code to see public test evidence.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 text-sm font-black ${passed ? "text-emerald-400" : "text-amber-300"}`}>
                    {passed ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                    {result.passed_count}/{result.total_count} tests passed
                  </div>
                  <Badge tone={result.simulated ? "amber" : "green"}>{result.provider}</Badge>
                </div>
                {result.message && <p className="rounded-lg bg-amber-400/10 p-3 text-[11px] leading-5 text-amber-200">{result.message}</p>}
                {result.tests.map((test, index) => (
                  <div key={index} className="rounded-xl border border-white/10 bg-white/[.03] p-3 font-mono text-[11px] text-white/65">
                    <div className="flex items-center justify-between">
                      <span className={test.passed ? "text-emerald-400" : "text-rose-400"}>Test {index + 1} · {test.status}</span>
                      {test.time !== undefined && <span>{test.time}s</span>}
                    </div>
                    {test.stderr && <pre className="mt-2 whitespace-pre-wrap text-rose-300">{test.stderr}</pre>}
                    {!test.passed && test.actual_output !== undefined && <pre className="mt-2 whitespace-pre-wrap">Actual: {test.actual_output || "(empty)"}</pre>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
