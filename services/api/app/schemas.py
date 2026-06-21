from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


Difficulty = Literal["easy", "medium", "hard"]


class EvidenceItem(BaseModel):
    name: str
    source: Literal["resume", "job_description", "both"]
    evidence: str


class CompetencyMap(BaseModel):
    candidate_title: str = "Candidate"
    target_role: str = "Target role"
    summary: str
    resume_skills: list[str] = Field(default_factory=list)
    required_skills: list[str] = Field(default_factory=list)
    overlapping_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    programming_languages: list[str] = Field(default_factory=list)
    tools_and_frameworks: list[str] = Field(default_factory=list)
    coursework: list[str] = Field(default_factory=list)
    concepts: list[str] = Field(default_factory=list)
    priority_topics: list[str] = Field(default_factory=list)
    evidence: list[EvidenceItem] = Field(default_factory=list)


class ResumeRequirementMatch(BaseModel):
    requirement: str
    category: Literal["technical", "domain", "quality"]
    priority: Literal["essential", "preferred"]
    match_level: Literal["strong", "related", "transferable", "missing"]
    confidence: int = Field(ge=0, le=100)
    jd_evidence: str
    resume_evidence: str
    rationale: str
    recommendation: str


class ResumeJobMatchAnalysis(BaseModel):
    summary: str
    requirements: list[ResumeRequirementMatch] = Field(min_length=1, max_length=35)
    resume_strengths: list[str] = Field(default_factory=list, max_length=10)
    improvement_suggestions: list[str] = Field(default_factory=list, max_length=8)
    gap_analysis: str


class MCQ(BaseModel):
    id: str
    topic: str
    difficulty: Difficulty
    question: str
    options: list[str]
    correct_option: int = Field(ge=0, le=3)
    explanation: str
    source_reason: str

    @field_validator("options")
    @classmethod
    def exactly_four_options(cls, value: list[str]) -> list[str]:
        if len(value) != 4:
            raise ValueError("MCQs require exactly four options")
        if len({item.strip().lower() for item in value}) != 4:
            raise ValueError("MCQ options must be distinct")
        return value


class TestCasePublic(BaseModel):
    input: str
    expected_output: str
    explanation: str | None = None


class CodingProblemPublic(BaseModel):
    id: str
    title: str
    difficulty: Difficulty
    statement: str
    input_format: str
    output_format: str
    constraints: list[str]
    examples: list[TestCasePublic]
    expected_complexity: str
    starter_code: dict[str, str]
    tags: list[str]


class AssessmentConfig(BaseModel):
    mcq_count: int = Field(default=5, ge=1, le=25)
    coding_count: int = Field(default=1, ge=1, le=3)
    interview_minutes: int = Field(default=5, ge=5, le=30)


class AssessmentPayload(BaseModel):
    title: str
    config: AssessmentConfig
    mcqs: list[MCQ]
    coding_problems: list[CodingProblemPublic]
    competency_topics: list[str]


class InterviewQuestion(BaseModel):
    id: str
    topic: str
    kind: Literal["intro", "technical", "project", "behavioral", "dsa", "closing"]
    question: str
    expected_signals: list[str]
    max_follow_ups: int = Field(default=2, ge=0, le=3)


class InterviewPlan(BaseModel):
    opening: str
    questions: list[InterviewQuestion]
    preferred_language_prompt: str
    dsa_problem_ids: list[str]
    closing: str


class InterviewTurn(BaseModel):
    question_id: str
    topic: str
    question: str
    answer: str
    depth: Literal["insufficient", "basic", "solid", "strong"]
    evidence: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    acknowledgement: str = "Thanks, that gives me some useful context."
    follow_up: str | None = None
    follow_up_kind: Literal["adaptive", "basic_recovery"] | None = None
    created_at: datetime | None = None


class InterviewCodingProblem(BaseModel):
    id: str
    title: str
    prompt: str
    difficulty: Literal["easy"] = "easy"
    language: str
    starter_code: str


class InterviewCodingReview(BaseModel):
    submission_id: str
    acknowledgement: str
    follow_up: str
    observations: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)


class CodeTestResult(BaseModel):
    passed: bool
    input: str
    expected_output: str | None = None
    actual_output: str | None = None
    status: str
    time: float | None = None
    memory: float | None = None
    stderr: str | None = None


class CodeRunResult(BaseModel):
    provider: str
    simulated: bool = False
    passed_count: int
    total_count: int
    tests: list[CodeTestResult]
    message: str | None = None


class ProctorEvent(BaseModel):
    type: str
    severity: Literal["info", "low", "medium", "high"] = "low"
    message: str
    occurred_at: datetime
    metadata: dict = Field(default_factory=dict)
    snapshot_path: str | None = None


class DimensionResult(BaseModel):
    name: str
    status: str
    evidence: list[str]
    gaps: list[str] = Field(default_factory=list)


class ReportPayload(BaseModel):
    audience: Literal["practice", "employer"]
    candidate_name: str
    dimensions: list[DimensionResult]
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    topic_results: dict[str, dict]
    coaching: list[str] = Field(default_factory=list)
    integrity_events: list[ProctorEvent] = Field(default_factory=list)
    disclaimer: str
