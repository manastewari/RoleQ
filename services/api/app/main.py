import hashlib
import json
import re
import secrets
import textwrap
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Literal

import httpx
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from .ai_provider import AIProvider
from .auth import (
    actor_from_request,
    create_access_token,
    current_actor,
    find_user_by_email,
    get_actor,
    get_identity,
    hash_password,
    provision_actor,
    user_response,
    verify_password,
)
from .config import get_settings
from .database import (
    AssessmentRecord,
    AttemptRecord,
    InterviewPlanRecord,
    ProfileRecord,
    ResumeAnalysisRecord,
    UserRecord,
    create_db_and_tables,
    get_session,
    utc_now,
)
from .document_parser import parse_document_bytes
from .judge0 import Judge0Adapter
from .problem_bank import PROBLEMS, get_problem, public_problem
from .resume_intelligence import analyze_resume, build_resume_preview
from .schemas import (
    AssessmentConfig,
    AssessmentPayload,
    CompetencyMap,
    DimensionResult,
    InterviewCodingProblem,
    InterviewCodingReview,
    InterviewPlan,
    InterviewTurn,
    ProctorEvent,
    ReportPayload,
)


settings = get_settings()
ai = AIProvider()
judge0 = Judge0Adapter()

app = FastAPI(
    title="RoleQ API",
    version="0.1.0",
    description="Functional local prototype. AI outputs and integrity events support human review only.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
database_startup_error: str | None = None
try:
    create_db_and_tables()
except Exception as exc:  # pragma: no cover - exercised only when deployment DB config is wrong.
    database_startup_error = f"{type(exc).__name__}: database connection failed during startup"

PUBLIC_PATHS = {"/health", "/auth/register", "/auth/login", "/docs", "/openapi.json", "/redoc"}


@app.middleware("http")
async def authenticate_request(request: Request, call_next):
    path = request.url.path.rstrip("/") or "/"
    if path in PUBLIC_PATHS or path.startswith("/docs/") or request.method == "OPTIONS":
        return await call_next(request)
    actor = await actor_from_request(request)
    if not actor:
        return JSONResponse(status_code=401, content={"detail": "Authentication required"})
    token = current_actor.set(actor)
    try:
        return await call_next(request)
    finally:
        current_actor.reset(token)


def dump(value) -> str:
    if hasattr(value, "model_dump"):
        value = value.model_dump(mode="json")
    return json.dumps(value, default=str)


def load(value: str, default):
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return default


def _pdf_safe(value: str) -> str:
    replacements = {
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2022": "-",
        "\u2192": "->",
        "\u2013": "-",
        "\u2014": "-",
    }
    cleaned = "".join(replacements.get(character, character) for character in value)
    return cleaned.encode("latin-1", "replace").decode("latin-1")


def _build_text_pdf(lines: list[str]) -> bytes:
    wrapped: list[str] = []
    for line in lines:
        safe = _pdf_safe(line)
        wrapped.extend(textwrap.wrap(safe, width=88, replace_whitespace=False) or [""])
    page_lines = [wrapped[index:index + 48] for index in range(0, len(wrapped), 48)] or [[""]]

    objects: list[bytes] = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    ]
    page_ids: list[int] = []
    for page in page_lines:
        page_id = len(objects) + 1
        content_id = page_id + 1
        page_ids.append(page_id)
        objects.append(
            (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] "
                f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {content_id} 0 R >>"
            ).encode()
        )
        commands = ["BT", "/F1 10 Tf", "48 800 Td", "14 TL"]
        for line in page:
            escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            commands.append(f"({escaped}) Tj")
            commands.append("T*")
        commands.append("ET")
        content = "\n".join(commands).encode("latin-1", "replace")
        objects.append(b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream")

    kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)
    objects[1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode()
    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, value in enumerate(objects, start=1):
        offsets.append(len(output))
        output.extend(f"{index} 0 obj\n".encode() + value + b"\nendobj\n")
    xref = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    output.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode())
    output.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return bytes(output)


def require(session: Session, model, identifier: str):
    record = session.get(model, identifier)
    if not record:
        raise HTTPException(status_code=404, detail=f"{model.__name__.replace('Record', '')} not found")
    actor = get_actor()
    allowed = False
    if isinstance(record, ResumeAnalysisRecord):
        allowed = record.owner_user_id == actor.id
    elif isinstance(record, ProfileRecord):
        allowed = record.owner_user_id == actor.id or record.employer_user_id == actor.id
    elif isinstance(record, InterviewPlanRecord):
        allowed = record.owner_user_id == actor.id
    elif isinstance(record, AssessmentRecord):
        allowed = record.owner_user_id == actor.id
        if not allowed and actor.role == "student":
            allowed = session.exec(
                select(AttemptRecord).where(
                    AttemptRecord.assessment_id == record.id,
                    AttemptRecord.candidate_user_id == actor.id,
                )
            ).first() is not None
    elif isinstance(record, AttemptRecord):
        assessment = session.get(AssessmentRecord, record.assessment_id)
        allowed = record.candidate_user_id == actor.id or bool(
            assessment and assessment.owner_user_id == actor.id
        )
    else:
        allowed = True
    if not allowed:
        raise HTTPException(status_code=404, detail=f"{model.__name__.replace('Record', '')} not found")
    return record


def assessment_response(record: AssessmentRecord, reveal_answers: bool = False) -> dict:
    data = load(record.data_json, {})
    if not reveal_answers:
        for mcq in data.get("mcqs", []):
            mcq.pop("correct_option", None)
            mcq.pop("explanation", None)
    return {
        "id": record.id,
        "profile_id": record.profile_id,
        "mode": record.mode,
        "preset": record.preset,
        "status": record.status,
        "invite_code": record.invite_code,
        "config": load(record.config_json, {}),
        "data": data,
        "created_at": record.created_at,
    }


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["student", "employer"]


class LoginRequest(BaseModel):
    email: str
    password: str


class AssessmentRequest(BaseModel):
    profile_id: str
    mode: Literal["practice", "employer"] = "practice"
    preset: Literal["demo", "full"] = "demo"
    mcq_count: int | None = Field(default=None, ge=1, le=25)
    coding_count: int | None = Field(default=None, ge=1, le=3)
    interview_minutes: int | None = Field(default=None, ge=5, le=30)


class AttemptRequest(BaseModel):
    assessment_id: str
    candidate_name: str = "Demo Candidate"


class MCQAnswersRequest(BaseModel):
    answers: dict[str, int]


class CodeRunRequest(BaseModel):
    attempt_id: str
    problem_id: str
    language: Literal["python", "java", "javascript", "typescript", "c", "cpp", "csharp", "go"]
    source_code: str = Field(min_length=1, max_length=100_000)
    submit: bool = False


class InterviewPlanRequest(BaseModel):
    profile_id: str


class InterviewReplyRequest(BaseModel):
    attempt_id: str
    question_id: str
    topic: str
    question: str
    expected_signals: list[str] = Field(default_factory=list)
    answer: str
    follow_up_count: int = Field(default=0, ge=0, le=3)
    max_follow_ups: int = Field(default=2, ge=0, le=3)
    recovery_question: bool = False


class InterviewCodingProblemRequest(BaseModel):
    attempt_id: str
    language: Literal["python", "java", "javascript", "typescript", "c", "cpp", "csharp", "go"]


class InterviewCodingSubmitRequest(BaseModel):
    attempt_id: str
    problem_id: str
    source_code: str = Field(min_length=8, max_length=100_000)
    problem: InterviewCodingProblem | None = None


class InterviewCodingAnswerRequest(BaseModel):
    attempt_id: str
    submission_id: str
    question: str
    answer: str = Field(min_length=1, max_length=20_000)


class RealtimeSessionRequest(BaseModel):
    attempt_id: str
    instructions: str | None = None


class ProctorEventRequest(BaseModel):
    events: list[ProctorEvent]


async def upload_text(upload: UploadFile) -> str:
    filename = Path(upload.filename or "document").name
    suffix = Path(filename).suffix.lower()
    if suffix == ".doc":
        raise HTTPException(
            status_code=415,
            detail="Legacy .doc files are not supported. Convert the file to DOCX, PDF, or TXT.",
        )
    if suffix not in {".pdf", ".docx", ".txt"}:
        raise HTTPException(status_code=415, detail="Only PDF, DOCX, and TXT files are supported.")
    content = await upload.read()
    if not content:
        raise HTTPException(status_code=422, detail="The uploaded file is empty.")
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Uploads are limited to 10 MB.")
    return parse_document_bytes(content, filename)


def create_assessment_record(
    session: Session,
    profile_record: ProfileRecord,
    mode: Literal["practice", "employer"],
    preset: Literal["demo", "full"],
    owner_user_id: str,
    mcq_count: int | None = None,
    coding_count: int | None = None,
    interview_minutes: int | None = None,
) -> tuple[AssessmentRecord, str]:
    profile = CompetencyMap.model_validate(load(profile_record.data_json, {}))
    defaults = {
        "demo": AssessmentConfig(),
        "full": AssessmentConfig(mcq_count=25, coding_count=3, interview_minutes=30),
    }
    config = defaults[preset].model_copy(deep=True)
    if mcq_count is not None:
        config.mcq_count = mcq_count
    if coding_count is not None:
        config.coding_count = coding_count
    if interview_minutes is not None:
        config.interview_minutes = interview_minutes
    mcqs, provider = ai.generate_mcqs(profile, config.mcq_count)
    payload = AssessmentPayload(
        title=f"{profile.target_role} · personalized assessment",
        config=config,
        mcqs=mcqs,
        coding_problems=[public_problem(problem) for problem in PROBLEMS[: config.coding_count]],
        competency_topics=profile.priority_topics,
    )
    record = AssessmentRecord(
        owner_user_id=owner_user_id,
        profile_id=profile_record.id,
        mode=mode,
        preset=preset,
        config_json=dump(config),
        data_json=dump(payload),
    )
    session.add(record)
    session.flush()
    return record, provider


def create_workspace_records(
    session: Session,
    profile: CompetencyMap,
    provider: str,
    actor_id: str,
    candidate_name: str,
    preset: Literal["demo", "full"],
    employer_user_id: str | None = None,
    assessment: AssessmentRecord | None = None,
) -> dict:
    profile_record = ProfileRecord(
        owner_user_id=actor_id,
        employer_user_id=employer_user_id,
        profile_kind="employer_candidate" if employer_user_id else "practice",
        data_json=dump(profile),
        provider=provider,
    )
    session.add(profile_record)
    session.flush()
    question_provider = "existing"
    if assessment is None:
        assessment, question_provider = create_assessment_record(
            session, profile_record, "practice", preset, actor_id
        )
    attempt = AttemptRecord(
        assessment_id=assessment.id,
        candidate_user_id=actor_id,
        profile_id=profile_record.id,
        candidate_name=candidate_name.strip() or "Candidate",
    )
    session.add(attempt)
    plan, plan_provider = ai.interview_plan(profile)
    plan_record = InterviewPlanRecord(
        owner_user_id=actor_id,
        profile_id=profile_record.id,
        data_json=dump(plan),
        provider=plan_provider,
    )
    session.add(plan_record)
    session.commit()
    session.refresh(profile_record)
    session.refresh(assessment)
    session.refresh(attempt)
    session.refresh(plan_record)
    return {
        "profile": {"id": profile_record.id, "provider": provider, "data": profile},
        "assessment": assessment_response(assessment),
        "attempt": {"id": attempt.id, "status": attempt.status},
        "interview_plan": {"id": plan_record.id, "provider": plan_provider, "data": plan},
        "question_provider": question_provider,
    }


@app.get("/health")
def health() -> dict:
    database_driver = settings.database_url.split(":", 1)[0]
    return {
        "status": "ok",
        "openai_configured": ai.available,
        "openai_model": settings.openai_model,
        "realtime_model": settings.openai_realtime_model,
        "auth_provider": "supabase" if settings.auth_mode != "local_test" else "local_test",
        "supabase_configured": bool(settings.supabase_url and settings.supabase_publishable_key),
        "database_driver": database_driver,
        "production_ready_database": database_driver.startswith("postgresql"),
        "database_connected": database_startup_error is None,
        "database_startup_error": database_startup_error,
        "judge0_url": settings.judge0_url,
        "supported_documents": ["pdf", "docx", "txt"],
        "supported_languages": ["python", "java", "javascript", "typescript", "c", "cpp", "csharp", "go"],
    }


@app.post("/auth/register", status_code=201)
def register(request: RegisterRequest, session: Session = Depends(get_session)) -> dict:
    if settings.auth_mode != "local_test":
        raise HTTPException(status_code=404, detail="Use Supabase Auth to create an account")
    email = request.email.strip().lower()
    if find_user_by_email(session, email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = UserRecord(
        name=request.name.strip(),
        email=email,
        password_hash=hash_password(request.password),
        role=request.role,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": user_response(user)}


@app.post("/auth/login")
def login(request: LoginRequest, session: Session = Depends(get_session)) -> dict:
    if settings.auth_mode != "local_test":
        raise HTTPException(status_code=404, detail="Use Supabase Auth to sign in")
    user = find_user_by_email(session, request.email)
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": user_response(user)}


@app.post("/auth/bootstrap")
def bootstrap_account(session: Session = Depends(get_session)) -> dict:
    identity = get_identity()
    return user_response(provision_actor(identity))


@app.get("/auth/me")
def me() -> dict:
    return user_response(get_actor())


@app.get("/problems")
def list_problems() -> list[dict]:
    return [public_problem(problem).model_dump(mode="json") for problem in PROBLEMS]


@app.get("/problems/{problem_id}")
def get_public_problem(problem_id: str) -> dict:
    try:
        return public_problem(get_problem(problem_id)).model_dump(mode="json")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Coding problem not found") from exc


@app.post("/resume-intelligence/analyses", status_code=201)
async def create_resume_analysis(
    resume: UploadFile = File(...),
    job_description: UploadFile = File(...),
    session: Session = Depends(get_session),
) -> dict:
    actor = get_actor("student")
    resume_text = await upload_text(resume)
    job_text = await upload_text(job_description)
    payload, provider = analyze_resume(resume_text, job_text, ai)
    record = ResumeAnalysisRecord(
        owner_user_id=actor.id,
        data_json=dump(payload),
        provider=provider,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return {
        "id": record.id,
        "provider": provider,
        "analysis": payload,
        "created_at": record.created_at,
        "resume_preview": {
            **build_resume_preview(resume_text, payload["matched_skills"], payload.get("evidence")),
            "filename": Path(resume.filename or "Resume").name,
        },
    }


@app.get("/resume-intelligence/analyses")
def list_resume_analyses(session: Session = Depends(get_session)) -> list[dict]:
    actor = get_actor("student")
    records = session.exec(
        select(ResumeAnalysisRecord)
        .where(ResumeAnalysisRecord.owner_user_id == actor.id)
        .order_by(ResumeAnalysisRecord.created_at.desc())
    ).all()
    return [
        {
            "id": record.id,
            "provider": record.provider,
            "analysis": load(record.data_json, {}),
            "created_at": record.created_at,
        }
        for record in records
    ]


@app.get("/resume-intelligence/analyses/{analysis_id}")
def get_resume_analysis(analysis_id: str, session: Session = Depends(get_session)) -> dict:
    get_actor("student")
    record = require(session, ResumeAnalysisRecord, analysis_id)
    return {
        "id": record.id,
        "provider": record.provider,
        "analysis": load(record.data_json, {}),
        "created_at": record.created_at,
    }


@app.delete("/resume-intelligence/analyses/{analysis_id}")
def delete_resume_analysis(analysis_id: str, session: Session = Depends(get_session)) -> dict:
    get_actor("student")
    record = require(session, ResumeAnalysisRecord, analysis_id)
    session.delete(record)
    session.commit()
    return {"deleted": True}


@app.post("/practice/workspaces", status_code=201)
async def create_practice_workspace(
    resume: UploadFile = File(...),
    job_description: UploadFile = File(...),
    preset: Literal["demo", "full"] = Form("demo"),
    session: Session = Depends(get_session),
) -> dict:
    actor = get_actor("student")
    resume_text = await upload_text(resume)
    job_text = await upload_text(job_description)
    profile, provider = ai.competency_map(resume_text, job_text)
    return create_workspace_records(session, profile, provider, actor.id, actor.name, preset)


@app.get("/profiles/{profile_id}")
def get_profile(profile_id: str, session: Session = Depends(get_session)) -> dict:
    record = require(session, ProfileRecord, profile_id)
    return {"id": record.id, "provider": record.provider, "data": load(record.data_json, {})}


@app.post("/assessments")
def create_assessment(request: AssessmentRequest, session: Session = Depends(get_session)) -> dict:
    actor = get_actor()
    if request.mode == "employer" and actor.role != "employer":
        raise HTTPException(status_code=403, detail="Employer account required")
    profile_record = require(session, ProfileRecord, request.profile_id)
    profile = CompetencyMap.model_validate(load(profile_record.data_json, {}))
    defaults = {"demo": AssessmentConfig(), "full": AssessmentConfig(mcq_count=25, coding_count=3, interview_minutes=30)}
    config = defaults[request.preset]
    if request.mcq_count is not None:
        config.mcq_count = request.mcq_count
    if request.coding_count is not None:
        config.coding_count = request.coding_count
    if request.interview_minutes is not None:
        config.interview_minutes = request.interview_minutes
    mcqs, provider = ai.generate_mcqs(profile, config.mcq_count)
    problems = [public_problem(problem) for problem in PROBLEMS[: config.coding_count]]
    payload = AssessmentPayload(
        title=f"{profile.target_role} · personalized assessment",
        config=config,
        mcqs=mcqs,
        coding_problems=problems,
        competency_topics=profile.priority_topics,
    )
    record = AssessmentRecord(
        owner_user_id=actor.id,
        profile_id=request.profile_id,
        mode=request.mode,
        preset=request.preset,
        config_json=dump(config),
        data_json=dump(payload),
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    response = assessment_response(record)
    response["question_provider"] = provider
    return response


@app.get("/assessments/{assessment_id}")
def get_assessment(
    assessment_id: str,
    reveal_answers: bool = Query(False),
    session: Session = Depends(get_session),
) -> dict:
    actor = get_actor()
    record = require(session, AssessmentRecord, assessment_id)
    if reveal_answers and record.owner_user_id != actor.id:
        raise HTTPException(status_code=403, detail="Answer keys are not available for invited assessments")
    return assessment_response(record, reveal_answers=reveal_answers)


@app.post("/assessments/{assessment_id}/publish")
def publish_assessment(assessment_id: str, session: Session = Depends(get_session)) -> dict:
    get_actor("employer")
    record = require(session, AssessmentRecord, assessment_id)
    record.status = "published"
    record.invite_code = record.invite_code or secrets.token_hex(3).upper()
    session.add(record)
    session.commit()
    return {"assessment_id": record.id, "status": record.status, "invite_code": record.invite_code}


@app.get("/assessments/invite/{invite_code}")
def get_assessment_by_invite(invite_code: str, session: Session = Depends(get_session)) -> dict:
    get_actor("student")
    record = session.exec(
        select(AssessmentRecord).where(
            AssessmentRecord.invite_code == invite_code.upper(),
            AssessmentRecord.status == "published",
        )
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Invite code not found")
    return assessment_response(record)


@app.post("/employer/assessments", status_code=201)
async def create_employer_assessment(
    job_description: UploadFile = File(...),
    preset: Literal["demo", "full"] = Form("demo"),
    mcq_count: int | None = Form(None),
    coding_count: int | None = Form(None),
    interview_minutes: int | None = Form(None),
    session: Session = Depends(get_session),
) -> dict:
    actor = get_actor("employer")
    job_text = await upload_text(job_description)
    profile, provider = ai.competency_map("", job_text)
    profile.candidate_title = "Invited candidate"
    profile_record = ProfileRecord(
        owner_user_id=actor.id,
        profile_kind="employer_role",
        data_json=dump(profile),
        provider=provider,
    )
    session.add(profile_record)
    session.flush()
    assessment, question_provider = create_assessment_record(
        session,
        profile_record,
        "employer",
        preset,
        actor.id,
        mcq_count,
        coding_count,
        interview_minutes,
    )
    assessment.status = "published"
    assessment.invite_code = secrets.token_hex(3).upper()
    session.add(assessment)
    session.commit()
    session.refresh(profile_record)
    session.refresh(assessment)
    return {
        "profile": {"id": profile_record.id, "provider": provider, "data": profile},
        "assessment": assessment_response(assessment),
        "question_provider": question_provider,
    }


@app.get("/employer/assessments")
def list_employer_assessments(session: Session = Depends(get_session)) -> list[dict]:
    actor = get_actor("employer")
    assessments = session.exec(
        select(AssessmentRecord)
        .where(AssessmentRecord.owner_user_id == actor.id)
        .order_by(AssessmentRecord.created_at.desc())
    ).all()
    output: list[dict] = []
    for assessment in assessments:
        attempts = session.exec(
            select(AttemptRecord).where(AttemptRecord.assessment_id == assessment.id)
        ).all()
        item = assessment_response(assessment)
        item["attempts"] = [
            {
                "id": attempt.id,
                "candidate_name": attempt.candidate_name,
                "status": attempt.status,
                "created_at": attempt.created_at,
            }
            for attempt in attempts
        ]
        output.append(item)
    return output


@app.post("/assessments/invite/{invite_code}/attempts", status_code=201)
async def create_invited_attempt(
    invite_code: str,
    resume: UploadFile = File(...),
    session: Session = Depends(get_session),
) -> dict:
    actor = get_actor("student")
    assessment = session.exec(
        select(AssessmentRecord).where(
            AssessmentRecord.invite_code == invite_code.upper(),
            AssessmentRecord.status == "published",
            AssessmentRecord.mode == "employer",
        )
    ).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Invite code not found")
    existing = session.exec(
        select(AttemptRecord).where(
            AttemptRecord.assessment_id == assessment.id,
            AttemptRecord.candidate_user_id == actor.id,
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You already joined this assessment")
    role_profile = session.get(ProfileRecord, assessment.profile_id)
    if not role_profile:
        raise HTTPException(status_code=404, detail="Role profile not found")
    role_data = CompetencyMap.model_validate(load(role_profile.data_json, {}))
    synthetic_job = (
        f"{role_data.target_role}\nRequired skills: "
        + ", ".join(role_data.required_skills + role_data.priority_topics)
    )
    resume_text = await upload_text(resume)
    profile, provider = ai.competency_map(resume_text, synthetic_job)
    profile.target_role = role_data.target_role
    return create_workspace_records(
        session,
        profile,
        provider,
        actor.id,
        actor.name,
        assessment.preset,
        employer_user_id=assessment.owner_user_id,
        assessment=assessment,
    )


@app.post("/attempts")
def create_attempt(request: AttemptRequest, session: Session = Depends(get_session)) -> dict:
    actor = get_actor("student")
    assessment = require(session, AssessmentRecord, request.assessment_id)
    if assessment.owner_user_id != actor.id:
        raise HTTPException(status_code=403, detail="Use an invite to join employer assessments")
    record = AttemptRecord(
        assessment_id=request.assessment_id,
        candidate_user_id=actor.id,
        profile_id=assessment.profile_id,
        candidate_name=request.candidate_name.strip() or actor.name,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return {"id": record.id, "assessment_id": record.assessment_id, "status": record.status}


@app.get("/attempts")
def list_attempts(session: Session = Depends(get_session)) -> list[dict]:
    actor = get_actor("student")
    attempts = session.exec(
        select(AttemptRecord)
        .where(AttemptRecord.candidate_user_id == actor.id)
        .order_by(AttemptRecord.created_at.desc())
    ).all()
    return [
        {
            "id": attempt.id,
            "assessment_id": attempt.assessment_id,
            "candidate_name": attempt.candidate_name,
            "status": attempt.status,
            "created_at": attempt.created_at,
            "completed_at": attempt.completed_at,
        }
        for attempt in attempts
    ]


def performance_snapshot(attempt: AttemptRecord, assessment: AssessmentRecord) -> dict:
    data = load(assessment.data_json, {})
    questions = data.get("mcqs", [])
    answers = load(attempt.mcq_answers_json, {})
    answered_questions = [item for item in questions if item.get("id") in answers]
    mcq_correct = sum(
        answers.get(item.get("id")) == item.get("correct_option")
        for item in answered_questions
    )
    mcq_score = (
        round((mcq_correct / len(answered_questions)) * 100)
        if answered_questions
        else None
    )

    submissions = load(attempt.code_submissions_json, [])
    final_submissions = [
        item for item in submissions
        if item.get("submit") and item.get("problem_id") and isinstance(item.get("result"), dict)
    ]
    latest_by_problem = {item["problem_id"]: item for item in final_submissions}
    coding_passed = sum(
        int(item["result"].get("passed_count", 0) or 0)
        for item in latest_by_problem.values()
    )
    coding_total = sum(
        int(item["result"].get("total_count", 0) or 0)
        for item in latest_by_problem.values()
    )
    coding_score = round((coding_passed / coding_total) * 100) if coding_total else None

    turns = [
        InterviewTurn.model_validate(item)
        for item in load(attempt.interview_json, [])
    ]
    depth_points = {"insufficient": 0, "basic": 33, "solid": 67, "strong": 100}
    interview_score = (
        round(sum(depth_points[turn.depth] for turn in turns) / len(turns))
        if turns
        else None
    )
    interview_depths = {
        depth: sum(turn.depth == depth for turn in turns)
        for depth in depth_points
    }

    topic_results: dict[str, dict[str, int]] = {}
    for item in answered_questions:
        topic = str(item.get("topic") or "General")
        bucket = topic_results.setdefault(topic, {"correct": 0, "total": 0})
        bucket["total"] += 1
        bucket["correct"] += int(
            answers.get(item.get("id")) == item.get("correct_option")
        )

    strengths = [
        topic
        for topic, result in topic_results.items()
        if result["total"] and result["correct"] / result["total"] >= 0.75
    ]
    gaps = [
        topic
        for topic, result in topic_results.items()
        if result["total"] and result["correct"] / result["total"] < 0.6
    ]
    strengths.extend(
        turn.topic for turn in turns if turn.depth in {"solid", "strong"}
    )
    gaps.extend(turn.topic for turn in turns if turn.depth in {"insufficient", "basic"})

    return {
        "attempt_id": attempt.id,
        "assessment_id": assessment.id,
        "title": data.get("title", "Interview session"),
        "mode": assessment.mode,
        "status": attempt.status,
        "started_at": attempt.created_at,
        "completed_at": attempt.completed_at,
        "metrics": {
            "mcq": {
                "score": mcq_score,
                "correct": mcq_correct,
                "answered": len(answered_questions),
                "available": len(questions),
            },
            "coding": {
                "score": coding_score,
                "passed_tests": coding_passed,
                "total_tests": coding_total,
                "submitted_problems": len(latest_by_problem),
            },
            "interview": {
                "score": interview_score,
                "evaluated_answers": len(turns),
                "depth_counts": interview_depths,
            },
        },
        "topic_results": topic_results,
        "strengths": list(dict.fromkeys(strengths))[:8],
        "gaps": list(dict.fromkeys(gaps))[:8],
    }


def metric_summary(sessions: list[dict], metric: str) -> dict:
    values = [
        session["metrics"][metric]["score"]
        for session in sessions
        if session["metrics"][metric]["score"] is not None
    ]
    return {
        "latest": values[-1] if values else None,
        "average": round(sum(values) / len(values)) if values else None,
        "change": values[-1] - values[0] if len(values) >= 2 else None,
        "sessions_measured": len(values),
    }


@app.get("/performance/me")
def get_my_performance(session: Session = Depends(get_session)) -> dict:
    actor = get_actor("student")
    attempts = session.exec(
        select(AttemptRecord)
        .where(AttemptRecord.candidate_user_id == actor.id)
        .order_by(AttemptRecord.created_at.asc())
    ).all()
    snapshots: list[dict] = []
    for attempt in attempts:
        assessment = session.get(AssessmentRecord, attempt.assessment_id)
        if assessment:
            snapshots.append(performance_snapshot(attempt, assessment))

    topic_totals: dict[str, dict[str, int]] = {}
    for snapshot in snapshots:
        for topic, result in snapshot["topic_results"].items():
            bucket = topic_totals.setdefault(topic, {"correct": 0, "total": 0})
            bucket["correct"] += result["correct"]
            bucket["total"] += result["total"]
    topic_performance = [
        {
            "topic": topic,
            "correct": result["correct"],
            "total": result["total"],
            "score": round((result["correct"] / result["total"]) * 100),
        }
        for topic, result in topic_totals.items()
        if result["total"]
    ]
    topic_performance.sort(key=lambda item: (-item["total"], item["topic"]))

    latest_with_evidence = next(
        (
            snapshot for snapshot in reversed(snapshots)
            if any(snapshot["metrics"][metric]["score"] is not None for metric in ("mcq", "coding", "interview"))
        ),
        None,
    )
    return {
        "user": user_response(actor),
        "session_count": len(snapshots),
        "completed_session_count": sum(item["status"] == "completed" for item in snapshots),
        "summary": {
            metric: metric_summary(snapshots, metric)
            for metric in ("mcq", "coding", "interview")
        },
        "sessions": snapshots,
        "topic_performance": topic_performance,
        "current_strengths": latest_with_evidence["strengths"] if latest_with_evidence else [],
        "current_gaps": latest_with_evidence["gaps"] if latest_with_evidence else [],
        "disclaimer": (
            "These are separate practice evidence trends derived from assessment JSON. "
            "They are not a composite score, hiring recommendation, or prediction of job performance."
        ),
    }


@app.get("/attempts/{attempt_id}")
def get_attempt(attempt_id: str, session: Session = Depends(get_session)) -> dict:
    record = require(session, AttemptRecord, attempt_id)
    return {
        "id": record.id,
        "assessment_id": record.assessment_id,
        "candidate_name": record.candidate_name,
        "status": record.status,
        "mcq_answers": load(record.mcq_answers_json, {}),
        "code_submissions": load(record.code_submissions_json, []),
        "interview": load(record.interview_json, []),
        "proctor_events": load(record.proctor_events_json, []),
        "artifacts": load(record.artifacts_json, []),
    }


@app.patch("/attempts/{attempt_id}/mcq")
def save_mcq_answers(
    attempt_id: str,
    request: MCQAnswersRequest,
    session: Session = Depends(get_session),
) -> dict:
    attempt = require(session, AttemptRecord, attempt_id)
    assessment = require(session, AssessmentRecord, attempt.assessment_id)
    data = load(assessment.data_json, {})
    correct = {item["id"]: item["correct_option"] for item in data.get("mcqs", [])}
    graded = {
        question_id: {
            "selected": selected,
            "correct": selected == correct.get(question_id),
            "correct_option": correct.get(question_id),
        }
        for question_id, selected in request.answers.items()
        if question_id in correct
    }
    attempt.mcq_answers_json = dump(request.answers)
    session.add(attempt)
    session.commit()
    return {
        "saved": True,
        "correct_count": sum(item["correct"] for item in graded.values()),
        "total_count": len(correct),
        "results": graded,
        "questions": data.get("mcqs", []),
    }


@app.post("/code/run")
async def run_code(request: CodeRunRequest, session: Session = Depends(get_session)) -> dict:
    attempt = require(session, AttemptRecord, request.attempt_id)
    try:
        get_problem(request.problem_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Coding problem not found") from exc
    result = await judge0.run(request.problem_id, request.language, request.source_code, request.submit)
    submissions = load(attempt.code_submissions_json, [])
    submissions.append(
        {
            "problem_id": request.problem_id,
            "language": request.language,
            "source_code": request.source_code,
            "submit": request.submit,
            "result": result.model_dump(mode="json"),
            "created_at": datetime.now(UTC).isoformat(),
        }
    )
    attempt.code_submissions_json = dump(submissions)
    session.add(attempt)
    session.commit()
    return result.model_dump(mode="json")


@app.post("/interviews/plan")
def create_interview_plan(request: InterviewPlanRequest, session: Session = Depends(get_session)) -> dict:
    actor = get_actor()
    profile_record = require(session, ProfileRecord, request.profile_id)
    profile = CompetencyMap.model_validate(load(profile_record.data_json, {}))
    plan, provider = ai.interview_plan(profile)
    record = InterviewPlanRecord(
        owner_user_id=actor.id,
        profile_id=request.profile_id,
        data_json=dump(plan),
        provider=provider,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return {"id": record.id, "provider": provider, "data": plan}


@app.get("/interviews/plan/{plan_id}")
def get_interview_plan(plan_id: str, session: Session = Depends(get_session)) -> dict:
    record = require(session, InterviewPlanRecord, plan_id)
    return {"id": record.id, "provider": record.provider, "data": load(record.data_json, {})}


@app.post("/interviews/coding/problem")
def create_interview_coding_problem(
    request: InterviewCodingProblemRequest,
    session: Session = Depends(get_session),
) -> dict:
    attempt = require(session, AttemptRecord, request.attempt_id)
    assessment = require(session, AssessmentRecord, attempt.assessment_id)
    profile_record = require(session, ProfileRecord, attempt.profile_id)
    profile = CompetencyMap.model_validate(load(profile_record.data_json, {}))
    submissions = load(attempt.code_submissions_json, [])
    existing_problem = next(
        (
            item.get("problem")
            for item in reversed(submissions)
            if item.get("kind") == "interview_coding_problem"
            and item.get("problem", {}).get("language") == request.language
            and not any(
                submission.get("kind") == "interview_coding_submission"
                and submission.get("problem_id") == item.get("problem", {}).get("id")
                for submission in submissions
            )
        ),
        None,
    )
    if existing_problem:
        return {
            "provider": next(
                (
                    item.get("provider", "local-dsa")
                    for item in reversed(submissions)
                    if item.get("kind") == "interview_coding_problem"
                    and item.get("problem", {}).get("id") == existing_problem.get("id")
                ),
                "local-dsa",
            ),
            "problem": InterviewCodingProblem.model_validate(existing_problem),
        }
    previous_titles = [
        item.get("problem", {}).get("title")
        for item in submissions
        if item.get("kind") == "interview_coding_problem" and item.get("problem", {}).get("title")
    ]
    # A deterministic ID prevents React Strict Mode's parallel development
    # requests from leaving the browser with an ID that was overwritten by the
    # other request. The question content still rotates by completed history.
    ordinal = len(previous_titles)
    nonce = hashlib.sha256(
        f"{attempt.id}:{request.language}:{ordinal}".encode()
    ).hexdigest()[:12]
    problem, provider = ai.interview_coding_problem(
        profile,
        request.language,
        nonce,
        previous_titles=previous_titles,
    )
    submissions.append(
        {
            "kind": "interview_coding_problem",
            "problem": problem.model_dump(mode="json"),
            "provider": provider,
            "created_at": datetime.now(UTC).isoformat(),
        }
    )
    attempt.code_submissions_json = dump(submissions)
    session.add(attempt)
    session.commit()
    return {"provider": provider, "problem": problem}


@app.post("/interviews/coding/submit")
def submit_interview_code(
    request: InterviewCodingSubmitRequest,
    session: Session = Depends(get_session),
) -> dict:
    attempt = require(session, AttemptRecord, request.attempt_id)
    submissions = load(attempt.code_submissions_json, [])
    problem_data = next(
        (
            item.get("problem")
            for item in reversed(submissions)
            if item.get("kind") == "interview_coding_problem"
            and item.get("problem", {}).get("id") == request.problem_id
        ),
        None,
    )
    if not problem_data and request.problem and request.problem.id == request.problem_id:
        # Recover safely from an older/stale client whose generated problem was
        # displayed before the idempotent persistence fix. Interview coding is
        # discussion-only, so retaining that exact validated prompt is correct.
        problem_data = request.problem.model_dump(mode="json")
        submissions.append(
            {
                "kind": "interview_coding_problem",
                "problem": problem_data,
                "provider": "client-recovered",
                "created_at": datetime.now(UTC).isoformat(),
            }
        )
    if not problem_data:
        raise HTTPException(status_code=404, detail="Interview coding problem not found")
    problem = InterviewCodingProblem.model_validate(problem_data)
    review, provider = ai.review_interview_code(problem, request.source_code)
    submission_id = secrets.token_hex(10)
    review_payload = InterviewCodingReview(
        submission_id=submission_id,
        acknowledgement=review.acknowledgement,
        follow_up=review.follow_up,
        observations=review.observations,
        gaps=review.gaps,
    )
    submissions.append(
        {
            "kind": "interview_coding_submission",
            "submission_id": submission_id,
            "problem_id": problem.id,
            "title": problem.title,
            "prompt": problem.prompt,
            "language": problem.language,
            "source_code": request.source_code,
            "review": review_payload.model_dump(mode="json"),
            "provider": provider,
            "created_at": datetime.now(UTC).isoformat(),
        }
    )
    attempt.code_submissions_json = dump(submissions)
    session.add(attempt)
    session.commit()
    return {"provider": provider, "review": review_payload}


@app.post("/interviews/coding/follow-up")
def answer_interview_code_follow_up(
    request: InterviewCodingAnswerRequest,
    session: Session = Depends(get_session),
) -> dict:
    attempt = require(session, AttemptRecord, request.attempt_id)
    submissions = load(attempt.code_submissions_json, [])
    submission = next(
        (
            item
            for item in reversed(submissions)
            if item.get("kind") == "interview_coding_submission"
            and item.get("submission_id") == request.submission_id
        ),
        None,
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Interview coding submission not found")
    submission["follow_up_answer"] = request.answer
    submission["follow_up_answered_at"] = datetime.now(UTC).isoformat()
    turn, provider = ai.evaluate_turn(
        question_id=f"coding-follow-up-{request.submission_id}",
        topic=f"Live coding: {submission.get('title', 'Easy coding question')}",
        question=request.question,
        expected_signals=["reasoning", "edge case", "complexity", "code-specific explanation"],
        answer=request.answer,
        follow_up_count=0,
        max_follow_ups=0,
    )
    turns = load(attempt.interview_json, [])
    turns.append(turn.model_dump(mode="json"))
    attempt.interview_json = dump(turns)
    attempt.code_submissions_json = dump(submissions)
    session.add(attempt)
    session.commit()
    return {"provider": provider, "turn": turn}


@app.post("/interviews/reply")
def interview_reply(request: InterviewReplyRequest, session: Session = Depends(get_session)) -> dict:
    attempt = require(session, AttemptRecord, request.attempt_id)
    turns = load(attempt.interview_json, [])
    recent_acknowledgements = [
        str(item.get("acknowledgement"))
        for item in turns[-3:]
        if item.get("acknowledgement")
    ]
    recent_context = [
        (
            f"Interviewer: {str(item.get('question', ''))[:400]}\n"
            f"Candidate: {str(item.get('answer', ''))[:800]}"
        )
        for item in turns[-3:]
    ]
    turn, provider = ai.evaluate_turn(
        question_id=request.question_id,
        topic=request.topic,
        question=request.question,
        expected_signals=request.expected_signals,
        answer=request.answer,
        follow_up_count=request.follow_up_count,
        max_follow_ups=request.max_follow_ups,
        recovery_question=request.recovery_question,
        recent_acknowledgements=recent_acknowledgements,
        recent_context=recent_context,
    )
    turns.append(turn.model_dump(mode="json"))
    attempt.interview_json = dump(turns)
    session.add(attempt)
    session.commit()
    return {"provider": provider, "turn": turn}


@app.post("/interviews/realtime/session")
async def realtime_session(request: RealtimeSessionRequest, session: Session = Depends(get_session)) -> dict:
    require(session, AttemptRecord, request.attempt_id)
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured; use browser speech mode.")
    safety_identifier = hashlib.sha256(request.attempt_id.encode("utf-8")).hexdigest()
    body = {
        "session": {
            "type": "realtime",
            "model": settings.openai_realtime_model,
            "instructions": request.instructions
            or (
                "# Role and objective\n"
                "You are Maya, a warm and professional AI technical interviewer in a live video call. The application "
                "controls the interview sequence and sends you an INTERVIEWER LINE to deliver.\n"
                "# Personality and tone\n"
                "Sound attentive, calm, curious, and conversational, like an experienced interviewer speaking "
                "spontaneously. Use contractions, gentle micro-pauses, and varied pacing. Never sound theatrical, "
                "overly cheerful, judgmental, scripted, or robotic.\n"
                "# Delivery\n"
                "Turn the supplied interviewer line into natural speech while preserving its intent. Ask one question "
                "at a time. You may lightly rephrase stiff wording, but never add a second substantive question, announce "
                "a rubric, name an evaluation category, or reveal scoring. Do not sound as if you are reading text.\n"
                "# Variety\n"
                "Do not reuse the same acknowledgement or opener in nearby turns. Avoid repeated phrases such as "
                "'let's unpack that', 'can you elaborate', and 'that's a great answer'.\n"
                "# Turn taking\n"
                "Stop speaking when the candidate starts. Never talk over them. If audio is unclear, ask them briefly "
                "to repeat the last part. Keep acknowledgements short and avoid filler such as 'let me think'."
            ),
            "reasoning": {"effort": "low"},
            "audio": {
                "input": {
                    "transcription": {
                        "model": "gpt-realtime-whisper",
                        "language": "en",
                        "delay": "medium",
                    },
                    "turn_detection": None,
                },
                "output": {"voice": "marin"},
            },
        }
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/realtime/client_secrets",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
                "OpenAI-Safety-Identifier": safety_identifier,
            },
            json=body,
        )
    if response.is_error:
        raise HTTPException(status_code=502, detail=f"Realtime session failed: {response.text[:500]}")
    return response.json()


@app.post("/proctoring/events/{attempt_id}")
def record_proctor_events(
    attempt_id: str,
    request: ProctorEventRequest,
    session: Session = Depends(get_session),
) -> dict:
    attempt = require(session, AttemptRecord, attempt_id)
    events = load(attempt.proctor_events_json, [])
    events.extend(event.model_dump(mode="json") for event in request.events)
    attempt.proctor_events_json = dump(events)
    session.add(attempt)
    session.commit()
    return {"saved": len(request.events), "total": len(events)}


@app.post("/proctoring/artifacts/{attempt_id}")
async def upload_artifact(
    attempt_id: str,
    kind: Literal["recording", "snapshot"] = Form(...),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
) -> dict:
    attempt = require(session, AttemptRecord, attempt_id)
    content = await file.read()
    if len(content) > 250 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Prototype recording limit is 250 MB.")
    suffix = Path(file.filename or "").suffix.lower() or (".webm" if kind == "recording" else ".jpg")
    stored_name = f"{attempt_id}-{kind}-{secrets.token_hex(4)}{suffix}"
    path = settings.storage_dir / stored_name
    path.write_bytes(content)
    artifact = {
        "id": secrets.token_hex(8),
        "kind": kind,
        "filename": stored_name,
        "path": str(path),
        "content_type": file.content_type,
        "created_at": datetime.now(UTC).isoformat(),
        "expires_at": (datetime.now(UTC) + timedelta(days=settings.artifact_retention_days)).isoformat(),
    }
    artifacts = load(attempt.artifacts_json, [])
    artifacts.append(artifact)
    attempt.artifacts_json = dump(artifacts)
    session.add(attempt)
    session.commit()
    return artifact


@app.get("/proctoring/artifacts/{attempt_id}/{artifact_id}")
def get_artifact(attempt_id: str, artifact_id: str, session: Session = Depends(get_session)):
    attempt = require(session, AttemptRecord, attempt_id)
    artifact = next((item for item in load(attempt.artifacts_json, []) if item.get("id") == artifact_id), None)
    if not artifact or not Path(artifact["path"]).exists():
        raise HTTPException(status_code=404, detail="Artifact not found")
    return FileResponse(artifact["path"], media_type=artifact.get("content_type"))


@app.delete("/proctoring/artifacts/{attempt_id}")
def delete_artifacts(attempt_id: str, session: Session = Depends(get_session)) -> dict:
    attempt = require(session, AttemptRecord, attempt_id)
    artifacts = load(attempt.artifacts_json, [])
    for artifact in artifacts:
        Path(artifact.get("path", "")).unlink(missing_ok=True)
    attempt.artifacts_json = "[]"
    session.add(attempt)
    session.commit()
    return {"deleted": len(artifacts)}


@app.post("/attempts/{attempt_id}/complete")
def complete_attempt(attempt_id: str, session: Session = Depends(get_session)) -> dict:
    attempt = require(session, AttemptRecord, attempt_id)
    attempt.status = "completed"
    attempt.completed_at = utc_now()
    session.add(attempt)
    session.commit()
    return {"id": attempt.id, "status": attempt.status, "completed_at": attempt.completed_at}


@app.get("/reports/{attempt_id}")
def get_report(
    attempt_id: str,
    audience: Literal["practice", "employer"] = Query("practice"),
    session: Session = Depends(get_session),
) -> ReportPayload:
    actor = get_actor()
    if actor.role == "student" and audience != "practice":
        raise HTTPException(status_code=403, detail="Student accounts receive coaching reports")
    if actor.role == "employer" and audience != "employer":
        raise HTTPException(status_code=403, detail="Employer accounts receive evidence reports")
    attempt = require(session, AttemptRecord, attempt_id)
    assessment = require(session, AssessmentRecord, attempt.assessment_id)
    data = load(assessment.data_json, {})
    answers = load(attempt.mcq_answers_json, {})
    questions = data.get("mcqs", [])
    correct_count = sum(answers.get(item["id"]) == item["correct_option"] for item in questions)
    topic_results: dict[str, dict] = {}
    for item in questions:
        bucket = topic_results.setdefault(item["topic"], {"correct": 0, "total": 0})
        bucket["total"] += 1
        bucket["correct"] += int(answers.get(item["id"]) == item["correct_option"])

    submissions = load(attempt.code_submissions_json, [])
    submitted = [item for item in submissions if item.get("submit")]
    latest_by_problem = {item["problem_id"]: item for item in submitted}
    interview_coding = [
        item for item in submissions if item.get("kind") == "interview_coding_submission"
    ]
    coding_evidence = [
        f"{problem_id}: {item['result'].get('passed_count', 0)}/{item['result'].get('total_count', 0)} hidden tests passed"
        + (" (simulated fallback)" if item["result"].get("simulated") else "")
        for problem_id, item in latest_by_problem.items()
    ]
    coding_evidence.extend(
        (
            f"Live coding - {item.get('title', 'Easy question')}: source submitted in "
            f"{item.get('language', 'selected language')}"
            + (" and code follow-up answered" if item.get("follow_up_answer") else "")
        )
        for item in interview_coding
    )

    turns = [InterviewTurn.model_validate(item) for item in load(attempt.interview_json, [])]
    depth_counts = {depth: sum(turn.depth == depth for turn in turns) for depth in ["insufficient", "basic", "solid", "strong"]}
    interview_evidence = [f"{turn.topic}: {turn.depth}" for turn in turns]
    events = [ProctorEvent.model_validate(item) for item in load(attempt.proctor_events_json, [])]
    strengths = [
        f"{topic}: all knowledge questions answered correctly"
        for topic, result in topic_results.items()
        if result["total"] and result["correct"] == result["total"]
    ]
    strengths.extend(
        f"{problem_id}: passed all submitted tests"
        for problem_id, item in latest_by_problem.items()
        if item["result"].get("total_count", 0)
        and item["result"].get("passed_count", 0) == item["result"].get("total_count", 0)
    )
    strengths.extend(
        f"{turn.topic}: {turn.depth} interview evidence"
        for turn in turns
        if turn.depth in {"solid", "strong"}
    )
    gaps = [
        f"{topic}: review missed knowledge concepts"
        for topic, result in topic_results.items()
        if result["correct"] < result["total"]
    ]
    gaps.extend(
        f"{problem_id}: {item['result'].get('total_count', 0) - item['result'].get('passed_count', 0)} tests still failing"
        for problem_id, item in latest_by_problem.items()
        if item["result"].get("passed_count", 0) < item["result"].get("total_count", 0)
    )
    gaps.extend(
        f"{turn.topic}: {gap}"
        for turn in turns
        for gap in turn.gaps
    )
    strengths = list(dict.fromkeys(strengths))[:12]
    gaps = list(dict.fromkeys(gaps))[:12]

    dimensions = [
        DimensionResult(
            name="MCQ knowledge",
            status=f"{correct_count}/{len(questions)} correct" if questions else "Not started",
            evidence=[f"{topic}: {result['correct']}/{result['total']}" for topic, result in topic_results.items()],
            gaps=[topic for topic, result in topic_results.items() if result["correct"] < result["total"]],
        ),
        DimensionResult(
            name="Coding",
            status=(
                f"{len(latest_by_problem)} assessment and {len(interview_coding)} live interview submissions"
            ),
            evidence=coding_evidence or ["No final coding submission recorded."],
            gaps=[
                gap
                for item in interview_coding
                for gap in item.get("review", {}).get("gaps", [])
            ][:8],
        ),
        DimensionResult(
            name="Technical interview",
            status=f"{len(turns)} answers evaluated",
            evidence=interview_evidence or ["No interview evidence recorded."],
            gaps=[gap for turn in turns for gap in turn.gaps][:8],
        ),
        DimensionResult(
            name="Integrity evidence",
            status=f"{len(events)} timestamped events",
            evidence=[f"{event.severity}: {event.message}" for event in events]
            or ["No integrity events were recorded."],
        ),
    ]
    coaching = []
    if audience == "practice":
        coaching = [
            "Review explanations for missed MCQs and restate each concept in your own words.",
            "For interview answers, use a situation → mechanism → trade-off → result structure.",
            "Re-run coding problems after analyzing failed test categories rather than patching individual outputs.",
        ]
        if depth_counts["insufficient"] or depth_counts["basic"]:
            coaching.append("Several interview answers need more concrete implementation details and verification evidence.")

    return ReportPayload(
        audience=audience,
        candidate_name=attempt.candidate_name,
        dimensions=dimensions,
        strengths=strengths,
        gaps=gaps,
        topic_results=topic_results,
        coaching=coaching,
        integrity_events=events if audience == "employer" else [],
        disclaimer=(
            "This report contains separate evidence dimensions only. It is not a composite score, integrity score, "
            "automated hiring decision, or proof of misconduct. A human reviewer must interpret the evidence."
        ),
    )


@app.get("/reports/{attempt_id}/pdf")
def download_report_pdf(
    attempt_id: str,
    audience: Literal["practice", "employer"] = Query("practice"),
    session: Session = Depends(get_session),
) -> Response:
    report = get_report(attempt_id=attempt_id, audience=audience, session=session)
    lines = [
        "ROLEQ INTERVIEW EVIDENCE REPORT",
        "Measure. Practice. Succeed.",
        "",
        f"Candidate: {report.candidate_name}",
        f"Report type: {'Candidate coaching' if audience == 'practice' else 'Employer evidence review'}",
        f"Generated: {utc_now().strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "STRENGTHS",
    ]
    lines.extend([f"- {item}" for item in report.strengths] or ["- No strong evidence recorded yet."])
    lines.extend(["", "DEVELOPMENT GAPS"])
    lines.extend([f"- {item}" for item in report.gaps] or ["- No specific gaps identified from the available evidence."])
    lines.extend(["", "ROUND EVIDENCE"])
    for dimension in report.dimensions:
        lines.extend(["", f"{dimension.name} - {dimension.status}"])
        lines.extend(f"- {item}" for item in dimension.evidence[:8])
        if dimension.gaps:
            lines.append("Gaps:")
            lines.extend(f"- {item}" for item in dimension.gaps[:8])
    if report.coaching:
        lines.extend(["", "RECOMMENDED NEXT STEPS"])
        lines.extend(f"- {item}" for item in report.coaching)
    lines.extend(["", "IMPORTANT", report.disclaimer])
    filename = re.sub(r"[^a-z0-9-]+", "-", report.candidate_name.lower()).strip("-") or "candidate"
    return Response(
        content=_build_text_pdf(lines),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}-interview-report.pdf"'},
    )


DEMO_RESUME = """
Alex Morgan
Software engineering student
Skills: Python, JavaScript, TypeScript, React, SQL, PostgreSQL, Git and Docker.
Coursework: Data Structures, Algorithms, DBMS, Operating Systems and Computer Networks.
Project: Built a React analytics dashboard and a Python recommendation API. Added tests and reduced response latency.
"""

DEMO_JOB = """
Junior Backend Engineer
We need Python, FastAPI, PostgreSQL, REST APIs, AWS, Docker, Redis and data structures.
The engineer should understand API design, testing, Git, CI/CD and basic system design.
"""


@app.post("/demo/bootstrap")
def demo_bootstrap(
    mode: Literal["practice", "employer"] = Query("practice"),
    session: Session = Depends(get_session),
) -> dict:
    actor = get_actor()
    if (mode == "practice" and actor.role != "student") or (
        mode == "employer" and actor.role != "employer"
    ):
        raise HTTPException(status_code=403, detail=f"{mode.title()} mode is not available for this account")
    profile, provider = ai.competency_map(DEMO_RESUME, DEMO_JOB)
    if mode == "practice":
        return create_workspace_records(session, profile, provider, actor.id, actor.name, "demo")
    profile_record = ProfileRecord(
        owner_user_id=actor.id,
        profile_kind="employer_role",
        data_json=dump(profile),
        provider=provider,
    )
    session.add(profile_record)
    session.flush()
    assessment, question_provider = create_assessment_record(
        session, profile_record, "employer", "demo", actor.id
    )
    assessment.status = "published"
    assessment.invite_code = secrets.token_hex(3).upper()
    session.add(assessment)
    session.commit()
    session.refresh(profile_record)
    session.refresh(assessment)
    return {
        "profile": {"id": profile_record.id, "provider": provider, "data": profile},
        "assessment": assessment_response(assessment),
        "question_provider": question_provider,
    }
