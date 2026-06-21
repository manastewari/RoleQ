"""Create the unified role-based platform schema."""

from alembic import op
import sqlalchemy as sa


revision = "0001_unified_platform"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])
    op.create_table(
        "resume_analyses",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("owner_user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("data_json", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_resume_analyses_owner_user_id", "resume_analyses", ["owner_user_id"])
    op.create_table(
        "profiles",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("owner_user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("employer_user_id", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("profile_kind", sa.String(), nullable=False),
        sa.Column("data_json", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_profiles_owner_user_id", "profiles", ["owner_user_id"])
    op.create_index("ix_profiles_employer_user_id", "profiles", ["employer_user_id"])
    op.create_table(
        "assessments",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("owner_user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("profile_id", sa.String(), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("mode", sa.String(), nullable=False),
        sa.Column("preset", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("invite_code", sa.String(), nullable=True),
        sa.Column("config_json", sa.Text(), nullable=False),
        sa.Column("data_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_assessments_owner_user_id", "assessments", ["owner_user_id"])
    op.create_table(
        "attempts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("assessment_id", sa.String(), sa.ForeignKey("assessments.id"), nullable=False),
        sa.Column("candidate_user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("profile_id", sa.String(), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("candidate_name", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("mcq_answers_json", sa.String(), nullable=False),
        sa.Column("code_submissions_json", sa.String(), nullable=False),
        sa.Column("interview_json", sa.String(), nullable=False),
        sa.Column("proctor_events_json", sa.String(), nullable=False),
        sa.Column("artifacts_json", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_attempts_assessment_id", "attempts", ["assessment_id"])
    op.create_index("ix_attempts_candidate_user_id", "attempts", ["candidate_user_id"])
    op.create_table(
        "interview_plans",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("owner_user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("profile_id", sa.String(), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("data_json", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_interview_plans_owner_user_id", "interview_plans", ["owner_user_id"])


def downgrade() -> None:
    op.drop_table("interview_plans")
    op.drop_table("attempts")
    op.drop_table("assessments")
    op.drop_table("profiles")
    op.drop_table("resume_analyses")
    op.drop_table("users")
