"use client";

import { useEffect, useState } from "react";
import { BookOpenCheck, BrainCircuit, CheckCircle2, Code2, Download, MessageSquareMore, ShieldAlert, Sparkles, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import type { Report, Role, Workspace } from "@/lib/types";
import { Badge, Button, Card, EmptyState, ErrorBanner } from "./ui";

const icons = [BookOpenCheck, Code2, MessageSquareMore, ShieldAlert];

export function ReportView({ workspace, audience }: { workspace: Workspace; audience: Role }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.report(workspace.attempt.id, audience).then(setReport).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load report."));
  }, [workspace.attempt.id, audience]);

  if (error) return <ErrorBanner message={error} />;
  if (!report) return <EmptyState icon={<BrainCircuit />} title="Assembling evidence" description="The report is collecting separate knowledge, coding, interview, and integrity dimensions." />;

  const download = async () => {
    const blob = await api.reportPdf(workspace.attempt.id, audience);
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${report.candidate_name.replace(/\s+/g, "-").toLowerCase()}-interview-report.pdf`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">{audience === "practice" ? "Candidate coaching" : "Human review packet"}</div>
          <h1 className="section-title">{report.candidate_name}&apos;s evidence</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Every dimension remains separate. This report does not rank, reject, or make a hiring decision.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void download()}><Download size={16} /> Download PDF</Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 size={18} /><h2 className="text-sm font-extrabold">Demonstrated strengths</h2></div>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
            {report.strengths.length ? report.strengths.map((item) => <li key={item}>• {item}</li>) : <li className="text-muted">Complete more rounds to establish strong evidence.</li>}
          </ul>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2 text-amber-700"><TriangleAlert size={18} /><h2 className="text-sm font-extrabold">Development gaps</h2></div>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
            {report.gaps.length ? report.gaps.map((item) => <li key={item}>• {item}</li>) : <li className="text-muted">No specific gaps were identified from the available evidence.</li>}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {report.dimensions.map((dimension, index) => {
          const Icon = icons[index] || Sparkles;
          return (
            <Card key={dimension.name} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon size={19} /></div>
                <Badge tone={index === 3 ? "amber" : "neutral"}>dimension {index + 1}</Badge>
              </div>
              <h3 className="mt-5 text-sm font-extrabold">{dimension.name}</h3>
              <div className="mt-1 font-serif text-xl font-bold">{dimension.status}</div>
              <ul className="mt-4 space-y-2 text-[11px] leading-5 text-muted">
                {dimension.evidence.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_.8fr]">
        <Card className="p-6">
          <h2 className="text-sm font-extrabold">Topic evidence</h2>
          <div className="mt-5 space-y-4">
            {Object.entries(report.topic_results).map(([topic, result]) => (
              <div key={topic}>
                <div className="flex items-center justify-between text-xs"><span className="font-bold">{topic}</span><span className="text-muted">{result.correct}/{result.total}</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${result.total ? result.correct / result.total * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            {!Object.keys(report.topic_results).length && <p className="text-xs text-muted">Complete the MCQ round to populate topic evidence.</p>}
          </div>
        </Card>

        {audience === "practice" ? (
          <Card className="p-6">
            <div className="flex items-center gap-2"><Sparkles size={18} className="text-coral" /><h2 className="text-sm font-extrabold">Next practice moves</h2></div>
            <ol className="mt-5 space-y-4">
              {report.coaching.map((item, index) => (
                <li key={item} className="flex gap-3 text-sm leading-6">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-black text-brand-700">{index + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="flex items-center gap-2"><ShieldAlert size={18} className="text-amber-600" /><h2 className="text-sm font-extrabold">Integrity event timeline</h2></div>
            <div className="mt-5 max-h-80 space-y-3 overflow-y-auto">
              {report.integrity_events.length ? report.integrity_events.map((event, index) => (
                <div key={`${event.occurred_at}-${index}`} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold">{event.message}</span><Badge tone={event.severity === "high" ? "red" : "amber"}>{event.severity}</Badge></div>
                  <div className="mt-2 text-[10px] text-muted">{new Date(event.occurred_at).toLocaleString()}</div>
                </div>
              )) : <p className="text-xs leading-5 text-muted">No integrity events were recorded. Absence of flags is not proof of behavior; it is simply the available evidence.</p>}
            </div>
          </Card>
        )}
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs leading-6 text-amber-900">
        {report.disclaimer}
      </div>
    </div>
  );
}
