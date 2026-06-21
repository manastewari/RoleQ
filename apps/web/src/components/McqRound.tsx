"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, CircleX, Send } from "lucide-react";
import { api } from "@/lib/api";
import type { MCQ, Workspace } from "@/lib/types";
import { Badge, Button, Card, ErrorBanner, Progress } from "./ui";

type Graded = {
  correct_count: number;
  total_count: number;
  results: Record<string, { selected: number; correct: boolean; correct_option: number }>;
  questions: MCQ[];
};

export function McqRound({ workspace, onContinue }: { workspace: Workspace; onContinue: () => void }) {
  const questions = workspace.assessment.data.mcqs;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [graded, setGraded] = useState<Graded | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const question = questions[index];
  const progress = useMemo(() => (Object.keys(answers).length / questions.length) * 100, [answers, questions.length]);

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      setGraded(await api.saveMcq(workspace.attempt.id, answers));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save answers.");
    } finally {
      setLoading(false);
    }
  };

  if (graded) {
    return (
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="grid gap-7 bg-[#17333b] p-8 text-white md:grid-cols-[1fr_240px] md:items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-[.14em] text-emerald-300">Knowledge round complete</div>
              <h1 className="mt-3 font-serif text-4xl font-bold">Evidence collected. Curiosity intact.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
                Your result stays separate from coding and interview evidence—there is no composite score hiding behind the curtain.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-5 text-center">
              <div className="text-5xl font-black">{graded.correct_count}<span className="text-2xl text-white/40">/{graded.total_count}</span></div>
              <div className="mt-2 text-xs font-bold uppercase tracking-wide text-white/55">Correct answers</div>
            </div>
          </div>
        </Card>
        <div className="space-y-3">
          {graded.questions.map((item, itemIndex) => {
            const result = graded.results[item.id];
            return (
              <Card key={item.id} className="p-5">
                <div className="flex items-start gap-3">
                  {result?.correct ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} /> : <CircleX className="mt-0.5 shrink-0 text-rose-600" size={20} />}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-muted">Q{itemIndex + 1}</span>
                      <Badge tone={result?.correct ? "green" : "red"}>{item.topic}</Badge>
                    </div>
                    <h3 className="mt-2 text-sm font-extrabold">{item.question}</h3>
                    <p className="mt-2 text-xs leading-5 text-muted">{item.explanation}</p>
                    {!result?.correct && typeof result?.correct_option === "number" && (
                      <p className="mt-2 text-xs font-bold text-brand-700">Best answer: {item.options[result.correct_option]}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        <div className="flex justify-end"><Button onClick={onContinue}>Continue to coding <ArrowRight size={16} /></Button></div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4">
        <div>
          <div className="eyebrow">Round one</div>
          <h1 className="section-title">Knowledge assessment</h1>
        </div>
        {error && <ErrorBanner message={error} />}
        <Card className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge tone="blue">{question.topic}</Badge>
              <Badge>{question.difficulty}</Badge>
            </div>
            <span className="text-xs font-black text-muted">{index + 1} / {questions.length}</span>
          </div>
          <h2 className="mt-7 text-xl font-extrabold leading-8">{question.question}</h2>
          <p className="mt-2 text-xs leading-5 text-muted">{question.source_reason}</p>
          <div className="mt-7 space-y-3">
            {question.options.map((option, optionIndex) => {
              const selected = answers[question.id] === optionIndex;
              return (
                <button
                  key={option}
                  onClick={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left text-sm font-semibold transition ${
                    selected ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line bg-white hover:border-slate-300"
                  }`}
                >
                  {selected ? <CheckCircle2 size={19} className="shrink-0" /> : <Circle size={19} className="shrink-0 text-slate-300" />}
                  <span>{option}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>
              <ArrowLeft size={16} /> Previous
            </Button>
            {index < questions.length - 1 ? (
              <Button disabled={answers[question.id] === undefined} onClick={() => setIndex((value) => value + 1)}>
                Next <ArrowRight size={16} />
              </Button>
            ) : (
              <Button loading={loading} disabled={Object.keys(answers).length !== questions.length} onClick={submit}>
                Submit round <Send size={16} />
              </Button>
            )}
          </div>
        </Card>
      </div>
      <div className="space-y-4 lg:pt-24">
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span>Completion</span><span>{Math.round(progress)}%</span>
          </div>
          <div className="mt-3"><Progress value={progress} /></div>
          <div className="mt-5 grid grid-cols-5 gap-2">
            {questions.map((item, itemIndex) => (
              <button
                key={item.id}
                onClick={() => setIndex(itemIndex)}
                className={`aspect-square rounded-lg text-xs font-black transition ${
                  itemIndex === index ? "bg-brand-600 text-white" : answers[item.id] !== undefined ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400"
                }`}
              >
                {itemIndex + 1}
              </button>
            ))}
          </div>
        </Card>
        <Card className="p-5 text-xs leading-5 text-muted">
          Answer every question before submitting. Explanations appear after the round in practice mode.
        </Card>
      </div>
    </div>
  );
}

