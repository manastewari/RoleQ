"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  Code2,
  MessageSquareMore,
  Minus,
  Target,
  Trophy,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  PerformanceMetricSummary,
  PerformanceProfile as PerformanceProfileData,
  PerformanceSession,
} from "@/lib/types";
import { Badge, Card, EmptyState, ErrorBanner, Progress } from "./ui";

type MetricKey = "mcq" | "coding" | "interview";

const metricConfig: Record<MetricKey, {
  label: string;
  icon: typeof BookOpenCheck;
  color: string;
  pale: string;
}> = {
  mcq: { label: "MCQ knowledge", icon: BookOpenCheck, color: "#2e7d6c", pale: "bg-emerald-50 text-emerald-700" },
  coding: { label: "Coding tests", icon: Code2, color: "#2563eb", pale: "bg-blue-50 text-blue-700" },
  interview: { label: "Interview depth", icon: MessageSquareMore, color: "#d97706", pale: "bg-amber-50 text-amber-700" },
};

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[11px] font-bold text-muted">Need 2 measured sessions</span>;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold ${value > 0 ? "text-emerald-700" : value < 0 ? "text-rose-700" : "text-muted"}`}>
      <Icon size={13} /> {value > 0 ? "+" : ""}{value} points since first measured session
    </span>
  );
}

function SummaryCard({
  metric,
  summary,
}: {
  metric: MetricKey;
  summary: PerformanceMetricSummary;
}) {
  const config = metricConfig[metric];
  const Icon = config.icon;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className={`grid size-10 place-items-center rounded-xl ${config.pale}`}><Icon size={18} /></div>
        <Badge>{summary.sessions_measured} sessions</Badge>
      </div>
      <div className="mt-5 text-xs font-bold text-muted">{config.label}</div>
      <div className="mt-1 flex items-end gap-2">
        <div className="text-3xl font-black">{summary.latest ?? "—"}</div>
        {summary.latest !== null && <div className="pb-1 text-xs font-bold text-muted">/ 100</div>}
      </div>
      <div className="mt-3"><Change value={summary.change} /></div>
    </Card>
  );
}

function TrendChart({
  sessions,
  metric,
}: {
  sessions: PerformanceSession[];
  metric: MetricKey;
}) {
  const config = metricConfig[metric];
  const measured = sessions
    .map((session, index) => ({
      index,
      value: session.metrics[metric].score,
      label: new Date(session.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      title: session.title,
    }))
    .filter((point): point is typeof point & { value: number } => point.value !== null);

  if (!measured.length) {
    return <div className="grid h-52 place-items-center rounded-2xl bg-slate-50 text-xs text-muted">No measured {config.label.toLowerCase()} evidence yet.</div>;
  }

  const width = 640;
  const height = 220;
  const padding = { left: 38, right: 20, top: 20, bottom: 38 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const x = (order: number) => padding.left + (measured.length === 1 ? chartWidth / 2 : (order / (measured.length - 1)) * chartWidth);
  const y = (value: number) => padding.top + chartHeight - (value / 100) * chartHeight;
  const points = measured.map((point, order) => `${x(order)},${y(point.value)}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[540px]">
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} stroke="#e5eaf1" strokeWidth="1" />
            <text x={padding.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="10" fill="#7b879a">{tick}</text>
          </g>
        ))}
        {measured.length > 1 && <polyline points={points} fill="none" stroke={config.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
        {measured.map((point, order) => (
          <g key={`${point.index}-${metric}`}>
            <circle cx={x(order)} cy={y(point.value)} r="5" fill="white" stroke={config.color} strokeWidth="3">
              <title>{point.title}: {point.value}/100</title>
            </circle>
            <text x={x(order)} y={height - 13} textAnchor="middle" fontSize="10" fill="#68748a">{point.label}</text>
            <text x={x(order)} y={y(point.value) - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill={config.color}>{point.value}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function SessionMetric({ label, score }: { label: string; score: number | null }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-bold">
        <span className="text-muted">{label}</span><span>{score === null ? "Not measured" : `${score}%`}</span>
      </div>
      <div className="mt-2"><Progress value={score || 0} /></div>
    </div>
  );
}

export function PerformanceProfile() {
  const [data, setData] = useState<PerformanceProfileData | null>(null);
  const [activeMetric, setActiveMetric] = useState<MetricKey>("mcq");
  const [error, setError] = useState("");

  useEffect(() => {
    api.performance()
      .then(setData)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load performance history."));
  }, []);

  const initials = useMemo(
    () => data?.user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "",
    [data],
  );

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <Card className="p-8 text-sm text-muted">Building your performance profile…</Card>;
  if (!data.sessions.length) {
    return (
      <EmptyState
        icon={<BarChart3 />}
        title="Your growth profile starts with your first session"
        description="Complete an MCQ, coding, or interview round and its evidence will appear here automatically."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card className="soft-grid p-7 sm:p-9">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-5">
            <div className="grid size-16 place-items-center rounded-2xl bg-[#17333b] text-xl font-black text-white">{initials}</div>
            <div>
              <div className="eyebrow">Student performance profile</div>
              <h1 className="mt-2 font-serif text-3xl font-bold">{data.user.name}</h1>
              <p className="mt-1 text-xs text-muted">{data.user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-white px-5 py-4 text-center">
              <div className="text-2xl font-black">{data.session_count}</div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted">Sessions</div>
            </div>
            <div className="rounded-2xl border border-line bg-white px-5 py-4 text-center">
              <div className="text-2xl font-black">{data.completed_session_count}</div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted">Completed</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(metricConfig) as MetricKey[]).map((metric) => (
          <SummaryCard key={metric} metric={metric} summary={data.summary[metric]} />
        ))}
      </div>

      <Card className="p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="text-lg font-extrabold">Growth across sessions</div>
            <p className="mt-1 text-xs text-muted">Each line uses only evidence recorded for that round.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(metricConfig) as MetricKey[]).map((metric) => (
              <button
                key={metric}
                onClick={() => setActiveMetric(metric)}
                className={`rounded-full px-3 py-2 text-xs font-extrabold transition ${activeMetric === metric ? "bg-[#17333b] text-white" : "bg-slate-100 text-muted hover:text-ink"}`}
              >
                {metricConfig[metric].label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5"><TrendChart sessions={data.sessions} metric={activeMetric} /></div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-2 text-sm font-extrabold"><Trophy size={17} className="text-emerald-700" /> Current strengths</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.current_strengths.length ? data.current_strengths.map((item) => <Badge key={item} tone="green">{item}</Badge>) : <span className="text-xs text-muted">More evidence is needed.</span>}
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2 text-sm font-extrabold"><Target size={17} className="text-amber-700" /> Current focus areas</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.current_gaps.length ? data.current_gaps.map((item) => <Badge key={item} tone="amber">{item}</Badge>) : <span className="text-xs text-muted">No repeated gaps yet.</span>}
          </div>
        </Card>
      </div>

      {data.topic_performance.length > 0 && (
        <Card className="p-6">
          <div className="text-sm font-extrabold">Knowledge topics over time</div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {data.topic_performance.slice(0, 10).map((topic) => (
              <div key={topic.topic}>
                <div className="flex items-center justify-between gap-3 text-xs font-bold">
                  <span>{topic.topic}</span><span className="text-muted">{topic.correct}/{topic.total} · {topic.score}%</span>
                </div>
                <div className="mt-2"><Progress value={topic.score} /></div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <div className="text-sm font-extrabold">Session evidence</div>
        </div>
        <div className="divide-y divide-line">
          {[...data.sessions].reverse().map((session) => (
            <div key={session.attempt_id} className="grid gap-5 px-6 py-5 lg:grid-cols-[1.1fr_1.4fr] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-extrabold">{session.title}</div>
                  <Badge tone={session.status === "completed" ? "green" : "neutral"}>{session.status.replace("_", " ")}</Badge>
                </div>
                <div className="mt-2 text-[11px] text-muted">{new Date(session.started_at).toLocaleString()} · {session.mode === "practice" ? "Practice" : "Employer assessment"}</div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <SessionMetric label="MCQ" score={session.metrics.mcq.score} />
                <SessionMetric label="Coding" score={session.metrics.coding.score} />
                <SessionMetric label="Interview" score={session.metrics.interview.score} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <p className="rounded-xl bg-slate-100 px-4 py-3 text-[11px] leading-5 text-muted">{data.disclaimer}</p>
    </div>
  );
}
