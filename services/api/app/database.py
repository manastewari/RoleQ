from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Column, Text
from sqlmodel import Field, Session, SQLModel, create_engine

from .config import get_settings


def new_id() -> str:
    return str(uuid4())


def utc_now() -> datetime:
    return datetime.now(UTC)


class UserRecord(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(default_factory=new_id, primary_key=True)
    name: str
    email: str = Field(index=True, unique=True)
    password_hash: str
    role: str = Field(index=True)
    created_at: datetime = Field(default_factory=utc_now)


class ResumeAnalysisRecord(SQLModel, table=True):
    __tablename__ = "resume_analyses"

    id: str = Field(default_factory=new_id, primary_key=True)
    owner_user_id: str = Field(index=True, foreign_key="users.id")
    data_json: str = Field(sa_column=Column(Text))
    provider: str = "local"
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ProfileRecord(SQLModel, table=True):
    __tablename__ = "profiles"

    id: str = Field(default_factory=new_id, primary_key=True)
    owner_user_id: str = Field(index=True, foreign_key="users.id")
    employer_user_id: str | None = Field(default=None, index=True, foreign_key="users.id")
    profile_kind: str = "practice"
    data_json: str = Field(sa_column=Column(Text))
    provider: str = "local"
    created_at: datetime = Field(default_factory=utc_now)


class AssessmentRecord(SQLModel, table=True):
    __tablename__ = "assessments"

    id: str = Field(default_factory=new_id, primary_key=True)
    owner_user_id: str = Field(index=True, foreign_key="users.id")
    profile_id: str = Field(foreign_key="profiles.id")
    mode: str = "practice"
    preset: str = "demo"
    status: str = "draft"
    invite_code: str | None = None
    config_json: str = Field(sa_column=Column(Text))
    data_json: str = Field(sa_column=Column(Text))
    created_at: datetime = Field(default_factory=utc_now)


class AttemptRecord(SQLModel, table=True):
    __tablename__ = "attempts"

    id: str = Field(default_factory=new_id, primary_key=True)
    assessment_id: str = Field(index=True, foreign_key="assessments.id")
    candidate_user_id: str = Field(index=True, foreign_key="users.id")
    profile_id: str = Field(foreign_key="profiles.id")
    candidate_name: str = "Demo Candidate"
    status: str = "in_progress"
    mcq_answers_json: str = "{}"
    code_submissions_json: str = "[]"
    interview_json: str = "[]"
    proctor_events_json: str = "[]"
    artifacts_json: str = "[]"
    created_at: datetime = Field(default_factory=utc_now)
    completed_at: datetime | None = None


class InterviewPlanRecord(SQLModel, table=True):
    __tablename__ = "interview_plans"

    id: str = Field(default_factory=new_id, primary_key=True)
    owner_user_id: str = Field(index=True, foreign_key="users.id")
    profile_id: str = Field(foreign_key="profiles.id")
    data_json: str = Field(sa_column=Column(Text))
    provider: str = "local"
    created_at: datetime = Field(default_factory=utc_now)


settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
