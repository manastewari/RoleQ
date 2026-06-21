import type {
  Assessment,
  CodeRunResult,
  CodingProblem,
  EmployerAssessment,
  InterviewPlan,
  InterviewCodingProblem,
  InterviewCodingReview,
  InterviewTurn,
  PerformanceProfile,
  ProctorEvent,
  Report,
  ResumeAnalysis,
  Role,
  User,
  Workspace,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const TOKEN_KEY = "intervue_access_token";

export function getAccessToken() {
  return typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken() {
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const data = await response.json();
      message = data.detail || data.message || message;
    } catch {
      // Keep status text when the response is not JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<Record<string, unknown>>("/health"),
  bootstrapAuth: () => request<User>("/auth/bootstrap", { method: "POST" }),
  me: () => request<User>("/auth/me"),
  bootstrap: (mode: Role) => request<Workspace>(`/demo/bootstrap?mode=${mode}`, { method: "POST" }),
  createPracticeWorkspace: async (resume: File, jobDescription: File, preset: "demo" | "full") => {
    const body = new FormData();
    body.append("resume", resume);
    body.append("job_description", jobDescription);
    body.append("preset", preset);
    return request<Workspace>("/practice/workspaces", { method: "POST", body });
  },
  createResumeAnalysis: async (resume: File, jobDescription: File) => {
    const body = new FormData();
    body.append("resume", resume);
    body.append("job_description", jobDescription);
    return request<ResumeAnalysis>("/resume-intelligence/analyses", { method: "POST", body });
  },
  listResumeAnalyses: () => request<ResumeAnalysis[]>("/resume-intelligence/analyses"),
  getResumeAnalysis: (id: string) => request<ResumeAnalysis>(`/resume-intelligence/analyses/${id}`),
  deleteResumeAnalysis: (id: string) =>
    request<{ deleted: boolean }>(`/resume-intelligence/analyses/${id}`, { method: "DELETE" }),
  createEmployerAssessment: async (
    jobDescription: File,
    preset: "demo" | "full",
    config?: { mcq_count?: number; coding_count?: number; interview_minutes?: number },
  ) => {
    const body = new FormData();
    body.append("job_description", jobDescription);
    body.append("preset", preset);
    Object.entries(config || {}).forEach(([key, value]) => {
      if (value !== undefined) body.append(key, String(value));
    });
    return request<{ profile: Workspace["profile"]; assessment: Assessment; question_provider: string }>(
      "/employer/assessments",
      { method: "POST", body },
    );
  },
  listEmployerAssessments: () => request<EmployerAssessment[]>("/employer/assessments"),
  getInvite: (code: string) => request<Assessment>(`/assessments/invite/${code}`),
  joinInvite: async (code: string, resume: File) => {
    const body = new FormData();
    body.append("resume", resume);
    return request<Workspace>(`/assessments/invite/${code}/attempts`, { method: "POST", body });
  },
  listAttempts: () => request<{
    id: string;
    assessment_id: string;
    candidate_name: string;
    status: string;
    created_at: string;
    completed_at?: string;
  }[]>("/attempts"),
  performance: () => request<PerformanceProfile>("/performance/me"),
  createAssessment: (
    profileId: string,
    mode: Role,
    preset: "demo" | "full",
    config?: { mcq_count?: number; coding_count?: number; interview_minutes?: number },
  ) =>
    request<Assessment>("/assessments", {
      method: "POST",
      body: JSON.stringify({ profile_id: profileId, mode, preset, ...config }),
    }),
  publishAssessment: (assessmentId: string) =>
    request<{ invite_code: string }>(`/assessments/${assessmentId}/publish`, { method: "POST" }),
  createAttempt: (assessmentId: string, candidateName: string) =>
    request<{ id: string; status: string }>("/attempts", {
      method: "POST",
      body: JSON.stringify({ assessment_id: assessmentId, candidate_name: candidateName }),
    }),
  createInterviewPlan: (profileId: string) =>
    request<{ id: string; provider: string; data: InterviewPlan }>("/interviews/plan", {
      method: "POST",
      body: JSON.stringify({ profile_id: profileId }),
    }),
  saveMcq: (attemptId: string, answers: Record<string, number>) =>
    request<{
      correct_count: number;
      total_count: number;
      results: Record<string, { selected: number; correct: boolean; correct_option: number }>;
      questions: Assessment["data"]["mcqs"];
    }>(`/attempts/${attemptId}/mcq`, {
      method: "PATCH",
      body: JSON.stringify({ answers }),
    }),
  runCode: (
    attemptId: string,
    problemId: string,
    language: string,
    sourceCode: string,
    submit: boolean,
  ) =>
    request<CodeRunResult>("/code/run", {
      method: "POST",
      body: JSON.stringify({
        attempt_id: attemptId,
        problem_id: problemId,
        language,
        source_code: sourceCode,
        submit,
      }),
    }),
  listProblems: () => request<CodingProblem[]>("/problems"),
  interviewReply: (payload: {
    attempt_id: string;
    question_id: string;
    topic: string;
    question: string;
    expected_signals: string[];
    answer: string;
    follow_up_count: number;
    max_follow_ups: number;
    recovery_question?: boolean;
  }) =>
    request<{ provider: string; turn: InterviewTurn }>("/interviews/reply", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  realtimeSession: (attemptId: string) =>
    request<{ value: string }>("/interviews/realtime/session", {
      method: "POST",
      body: JSON.stringify({ attempt_id: attemptId }),
    }),
  interviewCodingProblem: (attemptId: string, language: string) =>
    request<{ provider: string; problem: InterviewCodingProblem }>("/interviews/coding/problem", {
      method: "POST",
      body: JSON.stringify({ attempt_id: attemptId, language }),
    }),
  submitInterviewCode: (
    attemptId: string,
    problemId: string,
    sourceCode: string,
    problem?: InterviewCodingProblem,
  ) =>
    request<{ provider: string; review: InterviewCodingReview }>("/interviews/coding/submit", {
      method: "POST",
      body: JSON.stringify({
        attempt_id: attemptId,
        problem_id: problemId,
        source_code: sourceCode,
        problem,
      }),
    }),
  answerInterviewCodeFollowUp: (
    attemptId: string,
    submissionId: string,
    question: string,
    answer: string,
  ) =>
    request<{ provider: string; turn: InterviewTurn }>("/interviews/coding/follow-up", {
      method: "POST",
      body: JSON.stringify({
        attempt_id: attemptId,
        submission_id: submissionId,
        question,
        answer,
      }),
    }),
  recordProctorEvents: (attemptId: string, events: ProctorEvent[]) =>
    request<{ saved: number; total: number }>(`/proctoring/events/${attemptId}`, {
      method: "POST",
      body: JSON.stringify({ events }),
    }),
  uploadArtifact: async (attemptId: string, kind: "recording" | "snapshot", blob: Blob) => {
    const body = new FormData();
    body.append("kind", kind);
    body.append("file", blob, kind === "recording" ? "assessment.webm" : "evidence.jpg");
    return request<Record<string, unknown>>(`/proctoring/artifacts/${attemptId}`, {
      method: "POST",
      body,
    });
  },
  deleteArtifacts: (attemptId: string) =>
    request<{ deleted: number }>(`/proctoring/artifacts/${attemptId}`, { method: "DELETE" }),
  completeAttempt: (attemptId: string) =>
    request<{ status: string }>(`/attempts/${attemptId}/complete`, { method: "POST" }),
  report: (attemptId: string, audience: Role) =>
    request<Report>(`/reports/${attemptId}?audience=${audience}`),
  reportPdf: async (attemptId: string, audience: Role) => {
    const response = await fetch(`${API_URL}/reports/${attemptId}/pdf?audience=${audience}`, {
      headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
    });
    if (!response.ok) throw new Error(`Could not generate PDF report (${response.status})`);
    return response.blob();
  },
};

export async function buildWorkspaceFromFiles(
  resume: File,
  job: File,
  mode: Role,
  preset: "demo" | "full",
  candidateName: string,
): Promise<Workspace> {
  void mode;
  void candidateName;
  return api.createPracticeWorkspace(resume, job, preset);
}
