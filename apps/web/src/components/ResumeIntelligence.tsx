"use client";

import { Fragment, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  FileText,
  Lightbulb,
  Link2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ResumeAnalysis } from "@/lib/types";
import { Badge, Button, Card, ErrorBanner, Progress } from "./ui";

function fallbackResourceLinks(gaps: string[]): ResumeAnalysis["analysis"]["resource_links"] {
  const rules: { keywords: string[]; title: string; url: string }[] = [
    { keywords: ["academic eligibility", "cgpa", "class 10th", "class 12th"], title: "Purdue Resume Workshop", url: "https://owl.purdue.edu/owl/job_search_writing/resumes_and_vitas/resume_workshop/index.html" },
    { keywords: ["cloud", "aws", "ec2", "s3"], title: "AWS Cloud Practitioner Essentials", url: "https://skillbuilder.aws/learn/course/134/aws-cloud-practitioner-essentials" },
    { keywords: ["qc", "validate code", "code validation", "testing", "debug"], title: "pytest Good Practices", url: "https://docs.pytest.org/en/stable/explanation/goodpractices.html" },
    { keywords: ["excel", "spreadsheet"], title: "Microsoft Excel Learning", url: "https://support.microsoft.com/en-us/excel" },
    { keywords: ["vba", "macro"], title: "Getting Started with VBA in Office", url: "https://learn.microsoft.com/en-us/office/vba/library-reference/concepts/getting-started-with-vba-in-office" },
    { keywords: ["sql", "database query"], title: "PostgreSQL SQL Tutorial", url: "https://www.postgresql.org/docs/current/tutorial-sql.html" },
    { keywords: ["sas"], title: "SAS Documentation", url: "https://support.sas.com/en/documentation.html" },
    { keywords: ["sas or r", "r programming", "python/r/sas"], title: "R Manuals and Documentation", url: "https://cran.r-project.org/manuals.html" },
    { keywords: ["deadline", "multiple tasks", "multitask", "time management"], title: "Time Management Strategies", url: "https://www.atlassian.com/blog/productivity/time-management-strategies" },
    { keywords: ["communication", "presentation", "client conversation", "stakeholder"], title: "Google Technical Writing", url: "https://developers.google.com/tech-writing" },
    { keywords: ["problem solving", "first principles", "logical thinking"], title: "Problem Solving with Algorithms", url: "https://runestone.academy/ns/books/published/pythonds3/index.html" },
  ];
  const output: ResumeAnalysis["analysis"]["resource_links"] = [];
  const seen = new Set<string>();

  gaps.forEach((gap) => {
    const lowered = gap.toLowerCase();
    rules.forEach((rule) => {
      if (!rule.keywords.some((keyword) => lowered.includes(keyword)) || seen.has(rule.url)) return;
      seen.add(rule.url);
      output.push({
        skill: gap,
        title: rule.title,
        url: rule.url,
        description: `A focused starting point for strengthening evidence related to ${gap}.`,
      });
    });
  });

  if (!output.length && gaps.length) {
    output.push({
      skill: gaps[0],
      title: `Find courses for ${gaps[0]}`,
      url: `https://www.coursera.org/search?query=${encodeURIComponent(gaps[0])}`,
      description: `Browse guided courses related to ${gaps[0]}.`,
    });
  }
  return output;
}

function FilePicker({
  label,
  description,
  file,
  onChange,
}: {
  label: string;
  description: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="group flex min-h-40 cursor-pointer flex-col justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-5 transition hover:border-brand-500 hover:bg-brand-50/40">
      <input
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="grid size-11 place-items-center rounded-xl bg-white text-brand-700 shadow-sm ring-1 ring-slate-200 transition group-hover:ring-brand-300">
          {file ? <FileCheck2 size={21} /> : <UploadCloud size={21} />}
        </div>
        {file && <Badge tone="green">Ready</Badge>}
      </div>
      <div className="mt-6">
        <div className="truncate text-sm font-extrabold">{file?.name || label}</div>
        <div className="mt-1 text-xs leading-5 text-muted">{file ? "Click to replace this file" : description}</div>
        <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">PDF, DOCX or TXT · up to 10 MB</div>
      </div>
    </label>
  );
}

function HighlightedResume({ analysis }: { analysis: ResumeAnalysis }) {
  const preview = analysis.resume_preview;

  if (!preview) {
    return (
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <FileText size={18} className="text-brand-700" /> Resume match preview
          </div>
          <Badge>Private</Badge>
        </div>
        <div className="grid min-h-60 place-items-center bg-slate-50/70 p-8 text-center">
          <div>
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-brand-700 shadow-sm">
              <LockKeyhole size={20} />
            </div>
            <h3 className="mt-4 text-sm font-extrabold">Full preview is not stored</h3>
            <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-muted">
              For privacy, resume text is available only immediately after a new analysis. Upload the documents again
              to view the highlighted resume; saved results retain only short evidence snippets.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const highlights = [...preview.highlights]
    .filter((item) => item.start >= 0 && item.end <= preview.text.length && item.end > item.start)
    .sort((a, b) => a.start - b.start);
  const content = [];
  let cursor = 0;

  for (const item of highlights) {
    if (item.start < cursor) continue;
    content.push(<Fragment key={`text-${cursor}`}>{preview.text.slice(cursor, item.start)}</Fragment>);
    content.push(
      <mark
        key={`${item.skill}-${item.start}`}
        title={`Matched JD skill: ${item.skill}`}
        className="rounded bg-emerald-200/90 px-0.5 font-semibold text-emerald-950 ring-1 ring-inset ring-emerald-300"
      >
        {preview.text.slice(item.start, item.end)}
      </mark>,
    );
    cursor = item.end;
  }
  content.push(<Fragment key="text-end">{preview.text.slice(cursor)}</Fragment>);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col justify-between gap-3 border-b border-line px-6 py-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <FileText size={18} className="text-brand-700" /> Resume match preview
          </div>
          <div className="mt-1 max-w-lg truncate text-[11px] text-muted">{preview.filename}</div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-800">
          <span className="size-3 rounded bg-emerald-200 ring-1 ring-emerald-300" />
          Green text matches the job description
        </div>
      </div>
      <div className="bg-[#edf1f4] p-4 sm:p-7">
        <div className="mx-auto max-h-[620px] max-w-[850px] overflow-auto rounded-sm bg-white px-7 py-9 shadow-[0_14px_45px_rgba(23,32,51,.14)] sm:px-12">
          <div className="whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-slate-700">
            {content}
          </div>
          {preview.truncated && (
            <div className="mt-8 border-t border-dashed border-line pt-4 text-center text-[11px] text-muted">
              Preview shortened for display. Analysis used the complete extracted document.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ResumeIntelligence() {
  const [resume, setResume] = useState<File | null>(null);
  const [job, setJob] = useState<File | null>(null);
  const [selected, setSelected] = useState<ResumeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyze = async () => {
    if (!resume || !job) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.createResumeAnalysis(resume, job);
      setSelected(result);
      setResume(null);
      setJob(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not analyze these documents.");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    await api.deleteResumeAnalysis(id);
    if (selected?.id === id) setSelected(null);
  };

  const analysis = selected?.analysis;
  const recommendedResources = analysis
    ? analysis.resource_links.length
      ? analysis.resource_links
      : fallbackResourceLinks(analysis.missing_skills)
    : [];
  const gapRecommendations = analysis
    ? analysis.gap_recommendations?.length
      ? analysis.gap_recommendations
      : analysis.missing_skills.map((skill, index) => ({
          skill,
          priority: index < 2 ? ("high" as const) : ("medium" as const),
          actions: [
            `Learn the core concepts and common interview questions for ${skill}.`,
            `Build one small project that demonstrates practical use of ${skill}.`,
            "Practice explaining your decisions and results clearly.",
          ],
          resume_action: `Add ${skill} only after you can support it with truthful project, coursework, or experience evidence.`,
          resource: recommendedResources.find((item) => item.skill === skill),
        }))
    : [];
  const matchedQualities = analysis?.matched_qualities || [];
  const matchedTechnicalSkills = analysis?.matched_technical_skills || analysis?.matched_skills || [];
  const missingTechnicalSkills = analysis?.missing_technical_skills || analysis?.missing_skills || [];
  const matchDetails = new Map((analysis?.match_details || []).map((item) => [item.requirement, item]));

  return (
    <div className="space-y-7">
      <div className="rounded-[28px] bg-[#17343d] px-7 py-8 text-white shadow-xl shadow-slate-900/10 sm:px-9">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[.16em] text-emerald-300">Resume Intelligence</div>
            <h1 className="mt-3 max-w-3xl font-serif text-4xl font-bold leading-tight sm:text-5xl">
              See exactly where your resume meets the role.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/65">
              Matched evidence, practical gap-closing actions, and focused learning resources—without storing your
              original documents.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <ShieldCheck size={20} className="text-emerald-300" />
            <div>
              <div className="text-xs font-extrabold">Private by design</div>
              <div className="mt-0.5 text-[10px] text-white/50">Files are discarded after analysis</div>
            </div>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card className="p-6 sm:p-7">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-sm font-extrabold">
              <Sparkles size={18} className="text-brand-700" /> Start a new comparison
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">Upload both documents and we’ll map role requirements to evidence in your resume.</p>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Step 1 of 1</div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <FilePicker label="Choose your resume" description="The document you want to improve" file={resume} onChange={setResume} />
          <FilePicker label="Choose the job description" description="The role you want to target" file={job} onChange={setJob} />
        </div>
        <Button className="mt-5 min-w-44" disabled={!resume || !job} loading={loading} onClick={analyze}>
          <Target size={16} /> Analyze alignment
        </Button>
      </Card>

      {!analysis || !selected ? (
          <Card className="grid min-h-80 place-items-center p-10 text-center">
            <div>
              <FileText className="mx-auto text-brand-700" />
              <div className="mt-4 font-extrabold">Upload two documents to begin</div>
              <p className="mt-2 text-xs text-muted">Your highlighted match preview will appear here.</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <div className="grid lg:grid-cols-[220px_1fr]">
                <div className="bg-brand-700 p-7 text-white">
                  <div className="text-[10px] font-black uppercase tracking-[.14em] text-white/55">Document match</div>
                  <div className="mt-3 text-6xl font-black">{analysis.alignment_score}%</div>
                  <div className="mt-5"><Progress value={analysis.alignment_score} /></div>
                </div>
                <div className="p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-extrabold">Alignment summary</div>
                        {analysis.matching_method === "openai_structured" && (
                          <Badge tone="blue"><Sparkles size={11} className="mr-1" /> OpenAI evidence match</Badge>
                        )}
                      </div>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">{analysis.summary}</p>
                    </div>
                    <Button variant="ghost" onClick={() => remove(selected.id)}><Trash2 size={15} /> Delete</Button>
                  </div>
                  <div className="mt-5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted">Matched technical skills</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {matchedTechnicalSkills.length
                        ? matchedTechnicalSkills.map((item) => {
                            const level = matchDetails.get(item)?.match_level;
                            return (
                              <Badge key={item} tone={level === "transferable" ? "amber" : level === "related" ? "blue" : "green"}>
                                <CheckCircle2 size={12} className="mr-1" />
                                {item}{level && level !== "strong" ? ` · ${level}` : ""}
                              </Badge>
                            );
                          })
                        : <span className="text-xs text-muted">No direct technical overlap found yet.</span>}
                    </div>
                    {matchedQualities.length > 0 && (
                      <>
                        <div className="mt-4 text-[10px] font-black uppercase tracking-wider text-muted">Matched role qualities</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {matchedQualities.map((item) => {
                            const level = matchDetails.get(item)?.match_level;
                            return (
                              <Badge key={item} tone={level === "transferable" ? "amber" : "blue"}>
                                <CheckCircle2 size={12} className="mr-1" />
                                {item}{level && level !== "strong" ? ` · ${level}` : ""}
                              </Badge>
                            );
                          })}
                        </div>
                      </>
                    )}
                    {missingTechnicalSkills.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {missingTechnicalSkills.slice(0, 4).map((item) => <Badge key={item} tone="amber">{item} gap</Badge>)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <HighlightedResume analysis={selected} />

            <Card className="overflow-hidden border-amber-200">
              <div className="border-b border-amber-100 bg-amber-50/70 px-6 py-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2 text-base font-extrabold text-amber-950">
                      <CircleAlert size={19} className="text-amber-600" /> Skill gap action plan
                    </div>
                    <p className="mt-2 max-w-3xl text-xs leading-6 text-amber-900/70">{analysis.gap_analysis}</p>
                  </div>
                  <Badge tone="amber">{analysis.missing_skills.length} gaps</Badge>
                </div>
              </div>

              {gapRecommendations.length ? (
                <div className="divide-y divide-line">
                  {gapRecommendations.map((item, index) => (
                    <div key={item.skill} className="grid gap-5 px-6 py-6 lg:grid-cols-[180px_1fr]">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-muted">Priority {index + 1}</div>
                        <h3 className="mt-2 text-lg font-black">{item.skill}</h3>
                        <Badge tone={item.priority === "high" ? "red" : "amber"}>{item.priority} priority</Badge>
                      </div>
                      <div>
                        <div className="text-xs font-extrabold uppercase tracking-wider text-brand-700">How to improve</div>
                        <ol className="mt-3 grid gap-2 sm:grid-cols-3">
                          {item.actions.map((action, actionIndex) => (
                            <li key={action} className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                              <span className="mr-1 font-black text-brand-700">{actionIndex + 1}.</span> {action}
                            </li>
                          ))}
                        </ol>
                        <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/60 p-3 text-xs leading-5 text-brand-900">
                          <strong>Resume action:</strong> {item.resume_action}
                        </div>
                        {item.resource && (
                          <a href={item.resource.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-brand-700 hover:underline">
                            Start with {item.resource.title} <ArrowUpRight size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 px-6 py-7 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 size={20} /> No recognized requirement gaps. Focus on making your existing evidence more measurable.
                </div>
              )}
            </Card>

            <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
              <Card className="p-6">
                <div className="flex items-center gap-2 text-sm font-extrabold">
                  <Lightbulb size={17} className="text-amber-600" /> Resume improvements
                </div>
                <ul className="mt-4 space-y-3">
                  {analysis.improvement_suggestions.map((item, index) => (
                    <li key={item} className="flex gap-3 text-sm leading-6 text-muted">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-amber-50 text-[11px] font-black text-amber-700">{index + 1}</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-2 text-sm font-extrabold">
                  <Link2 size={17} className="text-brand-700" /> Recommended learning resources
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">Focused starting points for the requirements that need more evidence.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {recommendedResources.length ? recommendedResources.map((item) => (
                    <a
                      key={`${item.skill}-${item.url}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group rounded-xl border border-line p-4 transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-700"><BookOpen size={15} /></div>
                        <ArrowUpRight size={15} className="text-muted transition group-hover:text-brand-700" />
                      </div>
                      <div className="mt-3 text-[10px] font-black uppercase tracking-wider text-brand-700">{item.skill}</div>
                      <div className="mt-1 text-sm font-extrabold">{item.title}</div>
                      <p className="mt-1 text-[11px] leading-5 text-muted">{item.description}</p>
                    </a>
                  )) : (
                    <div className="col-span-full rounded-xl bg-slate-50 p-5 text-xs text-muted">
                      No additional resources are needed for the recognized requirements.
                    </div>
                  )}
                </div>
              </Card>
            </div>

            <Card className="overflow-hidden">
              <div className="border-b border-line px-6 py-4 text-sm font-extrabold">Grounded evidence used in this analysis</div>
              <div className="divide-y divide-line">
                {analysis.evidence.length ? analysis.evidence.map((item, index) => (
                  <div key={`${item.skill}-${index}`} className="grid gap-2 px-6 py-4 sm:grid-cols-[150px_1fr]">
                    <div><Badge tone="blue">{item.skill}</Badge></div>
                    <div>
                      <p className="text-sm font-semibold leading-6">“{item.snippet}”</p>
                      <p className="mt-1 text-[11px] leading-5 text-muted">{item.reason}</p>
                    </div>
                  </div>
                )) : <div className="px-6 py-8 text-sm text-muted">No short evidence snippets were found for recognized role requirements.</div>}
              </div>
            </Card>

            <p className="rounded-xl bg-slate-100 px-4 py-3 text-[11px] leading-5 text-muted">
              {analysis.disclaimer} Highlighting indicates keyword evidence, not verified proficiency.
            </p>
          </div>
        )}
    </div>
  );
}
