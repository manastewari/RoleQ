"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CheckCircle2, Code2, LoaderCircle, Send } from "lucide-react";
import { api } from "@/lib/api";
import type {
  InterviewCodingProblem,
  InterviewCodingReview,
  Workspace,
} from "@/lib/types";
import { Badge, Button, ErrorBanner } from "./ui";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[500px] place-items-center bg-[#101722] text-xs text-white/50">
      Loading editor…
    </div>
  ),
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

export function InterviewCodingRound({
  workspace,
  language,
  onProblemPresented,
  onFollowUp,
  followUpComplete,
}: {
  workspace: Workspace;
  language: string;
  onProblemPresented: (problem: InterviewCodingProblem) => void;
  onFollowUp: (review: InterviewCodingReview) => void;
  followUpComplete: boolean;
}) {
  const [problem, setProblem] = useState<InterviewCodingProblem | null>(null);
  const [source, setSource] = useState("");
  const [review, setReview] = useState<InterviewCodingReview | null>(null);
  const [loading, setLoading] = useState<"problem" | "submit" | null>("problem");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.interviewCodingProblem(workspace.attempt.id, language)
      .then(({ problem: created }) => {
        if (!active) return;
        setProblem(created);
        setSource(created.starter_code);
        setLoading(null);
        onProblemPresented(created);
      })
      .catch((caught) => {
        if (!active) return;
        setLoading(null);
        setError(caught instanceof Error ? caught.message : "Could not create the coding question.");
      });
    return () => {
      active = false;
    };
  // A fresh problem is intentionally created once when the coding round opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, workspace.attempt.id]);

  const submit = async () => {
    if (!problem || !source.trim()) return;
    setLoading("submit");
    setError("");
    try {
      const response = await api.submitInterviewCode(
        workspace.attempt.id,
        problem.id,
        source,
        problem,
      );
      setReview(response.review);
      onFollowUp(response.review);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit the interview code.");
    } finally {
      setLoading(null);
    }
  };

  if (loading === "problem") {
    return (
      <div className="grid min-h-96 place-items-center rounded-2xl border border-line bg-white">
        <div className="flex items-center gap-2 text-sm font-bold text-muted">
          <LoaderCircle size={18} className="animate-spin" /> Preparing a fresh easy question…
        </div>
      </div>
    );
  }

  if (!problem) return <ErrorBanner message={error || "No coding question is available."} />;

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <div className="grid min-h-[660px] overflow-hidden rounded-2xl border border-line bg-white shadow-card lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="border-b border-line p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2">
            <Badge tone="green">easy DSA</Badge>
            <Badge>{languageLabels[language] || language}</Badge>
          </div>
          <h2 className="mt-5 font-serif text-3xl font-bold tracking-tight">{problem.title}</h2>
          <p className="mt-5 text-sm leading-7 text-slate-700">{problem.prompt}</p>
          <div className="mt-7 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-xs leading-6 text-brand-700">
            This is a direct data-structures-and-algorithms question. After submission, Maya will ask one question based directly on your code.
          </div>
          {review && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-xs font-black text-emerald-800">
                <CheckCircle2 size={16} /> Code submitted
              </div>
              <p className="mt-2 text-sm leading-6 text-emerald-950">{review.follow_up}</p>
              <p className="mt-2 text-[11px] text-emerald-700">
                {followUpComplete ? "Follow-up answer saved." : "Answer Maya aloud after she finishes asking."}
              </p>
            </div>
          )}
        </section>

        <section className="flex min-w-0 flex-col bg-[#101722]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white/70">
              <Code2 size={16} /> solution
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
              No test cases in interview mode
            </span>
          </div>
          <Editor
            height="540px"
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
              readOnly: Boolean(review),
            }}
          />
          <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-4">
            <p className="text-[11px] text-white/40">
              Submit when your explanation-ready solution is complete.
            </p>
            <Button
              loading={loading === "submit"}
              disabled={Boolean(review) || !source.trim()}
              onClick={() => void submit()}
            >
              Submit code <Send size={15} />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
