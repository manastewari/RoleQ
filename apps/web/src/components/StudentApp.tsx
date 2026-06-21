"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, FileSearch2, MessageSquareMore, PlusCircle } from "lucide-react";
import { AppShell } from "./AppShell";
import { AssessmentProctor } from "./AssessmentProctor";
import { CodingRound } from "./CodingRound";
import { InterviewRound } from "./InterviewRound";
import { McqRound } from "./McqRound";
import { PerformanceProfile } from "./PerformanceProfile";
import { ReportView } from "./ReportView";
import { ResumeIntelligence } from "./ResumeIntelligence";
import { SetupView } from "./SetupView";
import { Button, Card, EmptyState } from "./ui";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { View, Workspace } from "@/lib/types";

function StudentDashboard({ setView }: { setView: (view: View) => void }) {
  return (
    <div className="space-y-6">
      <Card className="soft-grid p-8 sm:p-10">
        <div className="eyebrow">Student dashboard</div>
        <h1 className="section-title max-w-3xl">Choose the kind of preparation you need today.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
          Analyze how your resume aligns with a role or build a personalized practice session with knowledge,
          coding, and live interview rounds.
        </p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <FileSearch2 className="text-brand-700" />
          <h2 className="mt-6 text-lg font-extrabold">Analyze my resume</h2>
          <p className="mt-2 min-h-16 text-xs leading-6 text-muted">Compare your resume with a role and save structured alignment guidance.</p>
          <Button className="mt-5" variant="secondary" onClick={() => setView("intelligence")}>Open Resume Intelligence</Button>
        </Card>
        <Card className="p-6">
          <PlusCircle className="text-brand-700" />
          <h2 className="mt-6 text-lg font-extrabold">Create practice session</h2>
          <p className="mt-2 min-h-16 text-xs leading-6 text-muted">Generate knowledge, coding, and interview rounds from your documents.</p>
          <Button className="mt-5" onClick={() => setView("setup")}>Build an interview <ArrowRight size={15} /></Button>
        </Card>
      </div>
    </div>
  );
}

function SavedAttempts() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof api.listAttempts>>>([]);
  useEffect(() => { api.listAttempts().then(setItems).catch(() => undefined); }, []);
  return (
    <div className="space-y-6">
      <div><div className="eyebrow">History</div><h1 className="section-title">Saved attempts and reports</h1></div>
      {items.length ? (
        <Card className="divide-y divide-line overflow-hidden">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col justify-between gap-4 px-6 py-5 sm:flex-row sm:items-center">
              <div>
                <div className="text-sm font-extrabold">{item.candidate_name}</div>
                <div className="mt-1 text-xs capitalize text-muted">{item.status.replace("_", " ")} · {new Date(item.created_at).toLocaleString()}</div>
              </div>
              <Button variant="secondary" onClick={async () => {
                const blob = await api.reportPdf(item.id, "practice");
                const href = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = href;
                anchor.download = "interview-coaching-report.pdf";
                anchor.click();
                URL.revokeObjectURL(href);
              }}>Download report</Button>
            </div>
          ))}
        </Card>
      ) : <EmptyState icon={<BarChart3 />} title="No attempts yet" description="Create a practice session to begin building your performance history." />}
    </div>
  );
}

export function StudentApp({ initialWorkspace = null }: { initialWorkspace?: Workspace | null }) {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>("dashboard");
  const [workspace, setWorkspace] = useState<Workspace | null>(initialWorkspace);
  const [proctorRequested, setProctorRequested] = useState(Boolean(initialWorkspace));
  const [proctorStarted, setProctorStarted] = useState(false);
  const [proctorCompleted, setProctorCompleted] = useState(false);
  const [pendingProtectedView, setPendingProtectedView] = useState<View>("mcq");

  if (!user) return null;

  const ready = (nextWorkspace: Workspace, target?: View) => {
    setWorkspace(nextWorkspace);
    setProctorRequested(false);
    setProctorStarted(false);
    setProctorCompleted(false);
    const nextView = target || "mcq";
    if (nextView === "mcq" || nextView === "coding" || nextView === "interview") {
      setPendingProtectedView(nextView);
      setProctorRequested(true);
      setView("setup");
      return;
    }
    setView(nextView);
  };

  const navigate = (target: View) => {
    const protectedView = target === "mcq" || target === "coding" || target === "interview";
    if (workspace && protectedView) {
      setPendingProtectedView(target);
      if (!proctorStarted) {
        setProctorRequested(true);
        return;
      }
    }
    if (proctorStarted && !proctorCompleted && !protectedView) return;
    setView(target);
  };

  let content;
  if (view === "dashboard") content = <StudentDashboard setView={navigate} />;
  else if (view === "performance") content = <PerformanceProfile />;
  else if (view === "intelligence") content = <ResumeIntelligence />;
  else if (view === "setup") content = <SetupView role="practice" onReady={ready} />;
  else if (view === "attempts") content = <SavedAttempts />;
  else if (!workspace) {
    content = (
      <EmptyState
        icon={<MessageSquareMore />}
        title="Create a practice session first"
        description="Upload your resume and job description to unlock assessments and the live interview."
        action={<Button onClick={() => setView("setup")}>Open interview setup</Button>}
      />
    );
  } else if (view === "mcq") content = <McqRound workspace={workspace} onContinue={() => navigate("coding")} />;
  else if (view === "coding") content = <CodingRound workspace={workspace} onContinue={() => navigate("interview")} />;
  else if (view === "interview") {
    content = <InterviewRound workspace={workspace} onComplete={() => { setProctorCompleted(true); setView("report"); }} />;
  } else if (view === "report") content = <ReportView workspace={workspace} audience="practice" />;
  else content = <SavedAttempts />;

  return (
    <AppShell accountRole="student" user={user} view={view} setView={navigate} workspace={workspace} logout={logout}>
      {content}
      {workspace && (
        <AssessmentProctor
          key={workspace.attempt.id}
          attemptId={workspace.attempt.id}
          requested={proctorRequested}
          completed={proctorCompleted}
          onStarted={() => {
            setProctorStarted(true);
            setView(pendingProtectedView);
          }}
          onFinalized={() => {
            setProctorRequested(false);
            setProctorStarted(false);
          }}
        />
      )}
    </AppShell>
  );
}
