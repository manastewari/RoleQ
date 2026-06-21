"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FileText, ShieldCheck, UploadCloud } from "lucide-react";
import { StudentApp } from "@/components/StudentApp";
import { Button, Card, ErrorBanner } from "@/components/ui";
import { api } from "@/lib/api";
import { useRoleGuard } from "@/lib/auth";
import type { Assessment, Workspace } from "@/lib/types";

export default function InvitePage() {
  const params = useParams<{ code: string }>();
  const code = String(params.code || "").toUpperCase();
  const { user, loading: authLoading } = useRoleGuard("student");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [resume, setResume] = useState<File | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !code) return;
    api.getInvite(code)
      .then(setAssessment)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Invite not found."));
  }, [code, user]);

  if (authLoading || !user) return <div className="grid min-h-screen place-items-center text-sm text-muted">Checking your student account…</div>;
  if (workspace) return <StudentApp initialWorkspace={workspace} />;

  const join = async () => {
    if (!resume) return;
    setLoading(true);
    setError("");
    try {
      setWorkspace(await api.joinInvite(code, resume));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not join this assessment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <Card className="w-full max-w-2xl p-7 sm:p-10">
        <div className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><ShieldCheck /></div>
        <div className="mt-6 eyebrow">Employer assessment invite · {code}</div>
        <h1 className="mt-3 font-serif text-4xl font-bold">{assessment?.data.title || "Loading assessment…"}</h1>
        <p className="mt-4 text-sm leading-7 text-muted">
          Signed in as {user.name}. Upload your resume to build your candidate-specific competency map and begin the protected assessment.
        </p>
        {error && <div className="mt-5"><ErrorBanner message={error} /></div>}
        <label className="mt-7 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-brand-500">
          <input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(event) => setResume(event.target.files?.[0] || null)} />
          {resume ? <FileText className="text-brand-700" /> : <UploadCloud className="text-brand-700" />}
          <div className="mt-4 text-sm font-extrabold">{resume?.name || "Upload your resume"}</div>
          <div className="mt-1 text-xs text-muted">The source file and full extracted text are not retained.</div>
        </label>
        <Button className="mt-6 w-full" disabled={!assessment || !resume} loading={loading} onClick={join}>Join and prepare assessment</Button>
      </Card>
    </main>
  );
}
