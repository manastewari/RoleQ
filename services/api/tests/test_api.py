from io import BytesIO
from uuid import uuid4

from docx import Document
from fastapi.testclient import TestClient
from pypdf import PdfWriter
import json

from sqlmodel import Session, select

from app.auth import Actor, provision_actor
from app.database import AttemptRecord, ResumeAnalysisRecord, UserRecord, engine
from app.main import ai, app


client = TestClient(app)


def docx_bytes(text: str) -> bytes:
    document = Document()
    document.add_paragraph(text)
    stream = BytesIO()
    document.save(stream)
    return stream.getvalue()


def auth(role: str, name: str = "Test User") -> tuple[dict, dict[str, str]]:
    email = f"{role}-{uuid4().hex[:10]}@example.test"
    response = client.post(
        "/auth/register",
        json={"name": name, "email": email, "password": "password123", "role": role},
    )
    assert response.status_code == 201, response.text
    payload = response.json()
    return payload, {"Authorization": f"Bearer {payload['access_token']}"}


def test_health_and_authentication():
    health = client.get("/health")
    assert health.status_code == 200
    assert "txt" in health.json()["supported_documents"]
    assert client.get("/auth/me").status_code == 401

    payload, headers = auth("student", "Sam Student")
    assert payload["user"]["role"] == "student"
    assert client.get("/auth/me", headers=headers).json()["name"] == "Sam Student"
    login = client.post(
        "/auth/login",
        json={"email": payload["user"]["email"], "password": "password123"},
    )
    assert login.status_code == 200
    assert login.json()["user"]["role"] == "student"


def test_supabase_actor_is_auto_provisioned_when_roleq_row_is_missing():
    email = f"recovered-{uuid4().hex[:10]}@example.test"
    actor = Actor(
        id=f"supabase-{uuid4()}",
        name="Recovered Student",
        email=email,
        role="student",
        provisioned=False,
    )

    recovered = provision_actor(actor)

    assert recovered.provisioned
    assert recovered.role == "student"
    with Session(engine) as session:
        stored = session.get(UserRecord, actor.id)
        assert stored
        assert stored.email == email
        assert stored.name == "Recovered Student"


def test_student_resume_intelligence_is_private_and_derived_only(monkeypatch):
    monkeypatch.setattr(ai, "client", None)
    _, student_headers = auth("student")
    _, employer_headers = auth("employer")
    resume_text = (
        "Skills\nPython, React, SQL\nProjects\nBuilt a React dashboard and Python API "
        "that reduced response time by 20 percent. Collaborated with a cross-functional team, "
        "wrote unit tests with pytest, deployed Docker containers through Jenkins on Linux, "
        "and presented the technical approach to stakeholders."
    )
    jd_text = (
        "Requirements\nPython, FastAPI, PostgreSQL, AWS, Docker, REST APIs, Jenkins, Linux, "
        "unit testing, collaboration, and strong communication"
    )
    response = client.post(
        "/resume-intelligence/analyses",
        headers=student_headers,
        files={
            "resume": ("resume.docx", docx_bytes(resume_text), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            "job_description": ("role.txt", jd_text.encode(), "text/plain"),
        },
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert "Python" in data["analysis"]["matched_skills"]
    assert "Docker" in data["analysis"]["matched_skills"]
    assert "Jenkins" in data["analysis"]["matched_skills"]
    assert "Unit Testing" in data["analysis"]["matched_skills"]
    assert "Collaboration" in data["analysis"]["matched_qualities"]
    assert "Communication" in data["analysis"]["matched_qualities"]
    assert "FastAPI" in data["analysis"]["missing_skills"]
    assert len(data["analysis"]["matched_skills"]) >= 7
    assert data["analysis"]["alignment_score"] > 0
    assert data["resume_preview"]["filename"] == "resume.docx"
    assert data["resume_preview"]["text"]
    assert any(item["skill"] == "Python" for item in data["resume_preview"]["highlights"])
    assert any(item["skill"] == "FastAPI" for item in data["analysis"]["gap_recommendations"])
    assert data["analysis"]["resource_links"]
    assert "resume_text" not in data and "job_text" not in data

    with Session(engine) as session:
        stored = session.exec(select(ResumeAnalysisRecord).where(ResumeAnalysisRecord.id == data["id"])).one()
        assert resume_text not in stored.data_json
        assert jd_text not in stored.data_json
        assert "resume_preview" not in stored.data_json

    history = client.get("/resume-intelligence/analyses", headers=student_headers)
    assert history.status_code == 200
    assert history.json()[0]["id"] == data["id"]
    assert "resume_preview" not in history.json()[0]
    assert client.get("/resume-intelligence/analyses", headers=employer_headers).status_code == 403
    deleted = client.delete(f"/resume-intelligence/analyses/{data['id']}", headers=student_headers)
    assert deleted.status_code == 200


def test_practice_workspace_and_owned_rounds(monkeypatch):
    monkeypatch.setattr(ai, "client", None)
    user, headers = auth("student", "Sam Developer")
    workspace = client.post(
        "/practice/workspaces",
        headers=headers,
        data={"preset": "demo"},
        files={
            "resume": (
                "resume.docx",
                docx_bytes("Sam Developer\nSkills: Python React SQL\nCoursework: Data Structures and Algorithms"),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ),
            "job_description": (
                "job.docx",
                docx_bytes("Backend Engineer\nRequirements: Python FastAPI AWS PostgreSQL REST APIs Docker"),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ),
        },
    )
    assert workspace.status_code == 201, workspace.text
    payload = workspace.json()
    assert "documents" not in payload
    assert payload["attempt"]["id"]
    assert payload["profile"]["data"]["overlapping_skills"] == ["Python"]
    assert len(payload["assessment"]["data"]["mcqs"]) == 5
    assert payload["interview_plan"]["data"]["questions"][0]["id"] == "intro-1"

    answers = {f"mcq-{index}": 0 for index in range(1, 6)}
    graded = client.patch(
        f"/attempts/{payload['attempt']['id']}/mcq",
        headers=headers,
        json={"answers": answers},
    )
    assert graded.status_code == 200
    report = client.get(
        f"/reports/{payload['attempt']['id']}?audience=practice",
        headers=headers,
    )
    assert report.status_code == 200
    assert report.json()["candidate_name"] == user["user"]["name"]
    assert "composite score" in report.json()["disclaimer"].lower()

    _, other_headers = auth("student")
    assert client.get(f"/attempts/{payload['attempt']['id']}", headers=other_headers).status_code == 404


def test_employer_invite_requires_student_and_allows_employer_review(monkeypatch):
    monkeypatch.setattr(ai, "client", None)
    _, employer_headers = auth("employer", "Hiring Team")
    created = client.post(
        "/employer/assessments",
        headers=employer_headers,
        data={"preset": "demo"},
        files={
            "job_description": (
                "backend-role.txt",
                b"Junior Backend Engineer\nRequirements\nPython FastAPI PostgreSQL AWS Docker REST APIs",
                "text/plain",
            )
        },
    )
    assert created.status_code == 201, created.text
    invite_code = created.json()["assessment"]["invite_code"]
    assert invite_code

    assert client.get("/resume-intelligence/analyses", headers=employer_headers).status_code == 403
    assert client.post(
        f"/assessments/invite/{invite_code}/attempts",
        headers=employer_headers,
        files={"resume": ("resume.txt", b"Python FastAPI", "text/plain")},
    ).status_code == 403

    _, student_headers = auth("student", "Invited Candidate")
    invite = client.get(f"/assessments/invite/{invite_code}", headers=student_headers)
    assert invite.status_code == 200
    joined = client.post(
        f"/assessments/invite/{invite_code}/attempts",
        headers=student_headers,
        files={
            "resume": (
                "resume.txt",
                b"Skills: Python FastAPI SQL\nProject: Built a backend API with PostgreSQL.",
                "text/plain",
            )
        },
    )
    assert joined.status_code == 201, joined.text
    attempt_id = joined.json()["attempt"]["id"]
    assert client.get(f"/reports/{attempt_id}?audience=employer", headers=student_headers).status_code == 403
    employer_report = client.get(f"/reports/{attempt_id}?audience=employer", headers=employer_headers)
    assert employer_report.status_code == 200
    listed = client.get("/employer/assessments", headers=employer_headers)
    assert listed.status_code == 200
    assert listed.json()[0]["attempts"][0]["candidate_name"] == "Invited Candidate"


def test_scanned_pdf_and_legacy_doc_errors(monkeypatch):
    monkeypatch.setattr(ai, "client", None)
    _, headers = auth("student")
    blank = BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    writer.write(blank)
    scanned = client.post(
        "/resume-intelligence/analyses",
        headers=headers,
        files={
            "resume": ("scanned.pdf", blank.getvalue(), "application/pdf"),
            "job_description": ("role.txt", b"Requirements: Python", "text/plain"),
        },
    )
    assert scanned.status_code == 422
    assert "scanned" in scanned.json()["detail"].lower()
    legacy = client.post(
        "/practice/workspaces",
        headers=headers,
        files={
            "resume": ("legacy.doc", b"legacy", "application/msword"),
            "job_description": ("role.txt", b"Requirements: Python", "text/plain"),
        },
    )
    assert legacy.status_code == 415


def test_performance_profile_tracks_separate_round_growth(monkeypatch):
    monkeypatch.setattr(ai, "client", None)
    _, headers = auth("student", "Growth Student")

    attempt_ids: list[str] = []
    for index in range(2):
        workspace = client.post(
            "/practice/workspaces",
            headers=headers,
            data={"preset": "demo"},
            files={
                "resume": (
                    f"resume-{index}.txt",
                    b"Skills: Python React SQL. Coursework: Data Structures and Algorithms.",
                    "text/plain",
                ),
                "job_description": (
                    f"role-{index}.txt",
                    b"Backend Engineer Requirements: Python FastAPI PostgreSQL AWS Docker REST APIs",
                    "text/plain",
                ),
            },
        )
        assert workspace.status_code == 201, workspace.text
        attempt_id = workspace.json()["attempt"]["id"]
        attempt_ids.append(attempt_id)
        answers = {f"mcq-{number}": (1 if index == 0 else 0) for number in range(1, 6)}
        assert client.patch(
            f"/attempts/{attempt_id}/mcq",
            headers=headers,
            json={"answers": answers},
        ).status_code == 200

    with Session(engine) as session:
        first = session.get(AttemptRecord, attempt_ids[0])
        second = session.get(AttemptRecord, attempt_ids[1])
        first.code_submissions_json = json.dumps([
            {
                "problem_id": "two-sum-stream",
                "submit": True,
                "result": {"passed_count": 1, "total_count": 2},
            }
        ])
        first.interview_json = json.dumps([
            {
                "question_id": "technical-1",
                "topic": "Python",
                "question": "How does Python handle this?",
                "answer": "A short answer.",
                "depth": "basic",
                "evidence": [],
                "gaps": ["Needs mechanism detail."],
                "acknowledgement": "Okay.",
            }
        ])
        first.status = "completed"

        second.code_submissions_json = json.dumps([
            {
                "problem_id": "two-sum-stream",
                "submit": True,
                "result": {"passed_count": 2, "total_count": 2},
            }
        ])
        second.interview_json = json.dumps([
            {
                "question_id": "technical-1",
                "topic": "Python",
                "question": "How does Python handle this?",
                "answer": "A detailed answer with mechanisms and trade-offs.",
                "depth": "strong",
                "evidence": ["Detailed mechanism."],
                "gaps": [],
                "acknowledgement": "That is clear.",
            }
        ])
        second.status = "completed"
        session.add(first)
        session.add(second)
        session.commit()

    performance = client.get("/performance/me", headers=headers)
    assert performance.status_code == 200, performance.text
    payload = performance.json()
    assert payload["session_count"] == 2
    assert payload["completed_session_count"] == 2
    assert payload["summary"]["mcq"]["change"] == 100
    assert payload["summary"]["coding"]["change"] == 50
    assert payload["summary"]["interview"]["change"] == 67
    assert payload["sessions"][1]["metrics"]["interview"]["score"] == 100
    assert "composite score" in payload["disclaimer"].lower()

    _, employer_headers = auth("employer")
    assert client.get("/performance/me", headers=employer_headers).status_code == 403


def test_live_coding_uses_direct_dsa_and_submission_is_idempotent(monkeypatch):
    monkeypatch.setattr(ai, "client", None)
    _, headers = auth("student", "DSA Student")
    workspace = client.post(
        "/practice/workspaces",
        headers=headers,
        data={"preset": "demo"},
        files={
            "resume": (
                "resume.txt",
                b"Skills: Python. Coursework: Data Structures and Algorithms.",
                "text/plain",
            ),
            "job_description": (
                "role.txt",
                b"Software Engineer Requirements: Python Data Structures Algorithms",
                "text/plain",
            ),
        },
    )
    assert workspace.status_code == 201, workspace.text
    attempt_id = workspace.json()["attempt"]["id"]

    first = client.post(
        "/interviews/coding/problem",
        headers=headers,
        json={"attempt_id": attempt_id, "language": "python"},
    )
    duplicate = client.post(
        "/interviews/coding/problem",
        headers=headers,
        json={"attempt_id": attempt_id, "language": "python"},
    )
    assert first.status_code == 200, first.text
    assert duplicate.status_code == 200, duplicate.text
    problem = first.json()["problem"]
    assert problem["id"] == duplicate.json()["problem"]["id"]
    assert problem["title"] == duplicate.json()["problem"]["title"]
    assert problem["prompt"].startswith("Write a function")
    assert "you're helping" not in problem["prompt"].lower()
    assert "backend team" not in problem["prompt"].lower()
    assert "def solve(" in problem["starter_code"]

    submitted = client.post(
        "/interviews/coding/submit",
        headers=headers,
        json={
            "attempt_id": attempt_id,
            "problem_id": problem["id"],
            "problem": problem,
            "source_code": "def solve(text):\n    return text[::-1]\n",
        },
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["review"]["follow_up"].endswith("?")

    next_problem = client.post(
        "/interviews/coding/problem",
        headers=headers,
        json={"attempt_id": attempt_id, "language": "python"},
    )
    assert next_problem.status_code == 200, next_problem.text
    assert next_problem.json()["problem"]["id"] != problem["id"]
    assert next_problem.json()["problem"]["title"] != problem["title"]
