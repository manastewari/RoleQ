export type Role = "practice" | "employer";
export type AccountRole = "student" | "employer";
export type View =
  | "dashboard"
  | "performance"
  | "intelligence"
  | "setup"
  | "mcq"
  | "coding"
  | "interview"
  | "report"
  | "attempts"
  | "employer"
  | "employer_setup"
  | "employer_roles"
  | "employer_invites"
  | "employer_pipeline";

export interface User {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  user: User;
}

export interface DocumentInfo {
  id: string;
  kind: "resume" | "job_description";
  filename: string;
  status: string;
  preview: string;
  character_count: number;
  expires_at: string;
}

export interface EvidenceItem {
  name: string;
  source: "resume" | "job_description" | "both";
  evidence: string;
}

export interface CompetencyMap {
  candidate_title: string;
  target_role: string;
  summary: string;
  resume_skills: string[];
  required_skills: string[];
  overlapping_skills: string[];
  missing_skills: string[];
  programming_languages: string[];
  tools_and_frameworks: string[];
  coursework: string[];
  concepts: string[];
  priority_topics: string[];
  evidence: EvidenceItem[];
}

export interface MCQ {
  id: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  options: string[];
  correct_option?: number;
  explanation?: string;
  source_reason: string;
}

export interface TestCase {
  input: string;
  expected_output: string;
  explanation?: string;
}

export interface CodingProblem {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  statement: string;
  input_format: string;
  output_format: string;
  constraints: string[];
  examples: TestCase[];
  expected_complexity: string;
  starter_code: Record<string, string>;
  tags: string[];
}

export interface Assessment {
  id: string;
  profile_id: string;
  mode: Role;
  preset: "demo" | "full";
  status: string;
  invite_code?: string;
  config: {
    mcq_count: number;
    coding_count: number;
    interview_minutes: number;
  };
  data: {
    title: string;
    config: {
      mcq_count: number;
      coding_count: number;
      interview_minutes: number;
    };
    mcqs: MCQ[];
    coding_problems: CodingProblem[];
    competency_topics: string[];
  };
}

export interface InterviewQuestion {
  id: string;
  topic: string;
  kind: "intro" | "technical" | "project" | "behavioral" | "dsa" | "closing";
  question: string;
  expected_signals: string[];
  max_follow_ups: number;
}

export interface InterviewPlan {
  opening: string;
  questions: InterviewQuestion[];
  preferred_language_prompt: string;
  dsa_problem_ids: string[];
  closing: string;
}

export interface InterviewTurn {
  question_id: string;
  topic: string;
  question: string;
  answer: string;
  depth: "insufficient" | "basic" | "solid" | "strong";
  evidence: string[];
  gaps: string[];
  acknowledgement: string;
  follow_up?: string;
  follow_up_kind?: "adaptive" | "basic_recovery";
}

export interface InterviewCodingProblem {
  id: string;
  title: string;
  prompt: string;
  difficulty: "easy";
  language: string;
  starter_code: string;
}

export interface InterviewCodingReview {
  submission_id: string;
  acknowledgement: string;
  follow_up: string;
  observations: string[];
  gaps: string[];
}

export interface Workspace {
  profile: {
    id: string;
    provider: string;
    data: CompetencyMap;
  };
  assessment: Assessment;
  attempt: {
    id: string;
    status: string;
  };
  interview_plan: {
    id: string;
    provider: string;
    data: InterviewPlan;
  };
  question_provider: string;
}

export interface ResumeAnalysisPayload {
  summary: string;
  alignment_score: number;
  matched_skills: string[];
  missing_skills: string[];
  matched_technical_skills?: string[];
  missing_technical_skills?: string[];
  matched_qualities?: string[];
  missing_qualities?: string[];
  resume_skills: string[];
  required_skills: string[];
  evidence: { skill: string; snippet: string; reason: string }[];
  match_details?: {
    requirement: string;
    category: "technical" | "domain" | "quality";
    priority: "essential" | "preferred";
    match_level: "strong" | "related" | "transferable" | "missing";
    confidence: number;
    jd_evidence: string;
    resume_evidence: string;
    rationale: string;
    recommendation: string;
  }[];
  matching_method?: "openai_structured" | "local";
  gap_analysis: string;
  improvement_suggestions: string[];
  gap_recommendations?: {
    skill: string;
    priority: "high" | "medium";
    actions: string[];
    resume_action: string;
    resource?: { skill: string; title: string; url: string; description: string } | null;
  }[];
  resource_links: { skill: string; title: string; url: string; description: string }[];
  disclaimer: string;
}

export interface ResumeAnalysis {
  id: string;
  provider: string;
  analysis: ResumeAnalysisPayload;
  created_at: string;
  resume_preview?: {
    filename: string;
    text: string;
    highlights: { skill: string; start: number; end: number }[];
    truncated: boolean;
  };
}

export interface EmployerAssessment extends Assessment {
  attempts?: {
    id: string;
    candidate_name: string;
    status: string;
    created_at: string;
  }[];
}

export interface CodeTestResult {
  passed: boolean;
  input: string;
  expected_output?: string;
  actual_output?: string;
  status: string;
  time?: number;
  memory?: number;
  stderr?: string;
}

export interface CodeRunResult {
  provider: string;
  simulated: boolean;
  passed_count: number;
  total_count: number;
  tests: CodeTestResult[];
  message?: string;
}

export interface ProctorEvent {
  type: string;
  severity: "info" | "low" | "medium" | "high";
  message: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
  snapshot_path?: string;
}

export interface Report {
  audience: Role;
  candidate_name: string;
  strengths: string[];
  gaps: string[];
  dimensions: {
    name: string;
    status: string;
    evidence: string[];
    gaps: string[];
  }[];
  topic_results: Record<string, { correct: number; total: number }>;
  coaching: string[];
  integrity_events: ProctorEvent[];
  disclaimer: string;
}

export interface PerformanceMetricSummary {
  latest: number | null;
  average: number | null;
  change: number | null;
  sessions_measured: number;
}

export interface PerformanceSession {
  attempt_id: string;
  assessment_id: string;
  title: string;
  mode: Role;
  status: string;
  started_at: string;
  completed_at?: string | null;
  metrics: {
    mcq: {
      score: number | null;
      correct: number;
      answered: number;
      available: number;
    };
    coding: {
      score: number | null;
      passed_tests: number;
      total_tests: number;
      submitted_problems: number;
    };
    interview: {
      score: number | null;
      evaluated_answers: number;
      depth_counts: Record<"insufficient" | "basic" | "solid" | "strong", number>;
    };
  };
  topic_results: Record<string, { correct: number; total: number }>;
  strengths: string[];
  gaps: string[];
}

export interface PerformanceProfile {
  user: User;
  session_count: number;
  completed_session_count: number;
  summary: {
    mcq: PerformanceMetricSummary;
    coding: PerformanceMetricSummary;
    interview: PerformanceMetricSummary;
  };
  sessions: PerformanceSession[];
  topic_performance: {
    topic: string;
    correct: number;
    total: number;
    score: number;
  }[];
  current_strengths: string[];
  current_gaps: string[];
  disclaimer: string;
}
