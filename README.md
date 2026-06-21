# RoleQ

![RoleQ — Measure. Practice. Succeed.](apps/web/public/roleq-logo.svg)

**Measure. Practice. Succeed.**

RoleQ is an AI-powered interview preparation and assessment platform for
students and employers. It turns a candidate's resume and a job description
into personalized resume guidance, knowledge assessments, coding exercises,
and adaptive spoken interviews.

## The problem

Interview preparation is often generic. Candidates practise questions that may
not match their experience or the role, receive little evidence-based feedback,
and struggle to understand which skills they should improve first. Employers
also spend time manually creating role-specific assessments and reviewing
disconnected results.

RoleQ addresses this by grounding the complete preparation journey in two
documents: the candidate's resume and the target job description. It identifies
relevant evidence, highlights gaps, creates role-specific practice, and reports
each assessment dimension separately.

## Product demo

- **Local prototype:** [http://localhost:3000](http://localhost:3000) after
  completing the setup below.
- **Hosted application:** [https://roleq.vercel.app](https://roleq.vercel.app)
- **Production API health:** [https://roleq.vercel.app/_/api/health](https://roleq.vercel.app/_/api/health)

## The idea

RoleQ provides two role-based workspaces:

### Student workspace

- Analyze a PDF, DOCX, or TXT resume against a job description.
- Use OpenAI semantic evidence matching to classify requirements as strong,
  related, transferable, or missing.
- Preview the resume with matched evidence highlighted.
- Receive gap-specific recommendations and trusted learning-resource links.
- Generate personalized MCQ and coding assessments.
- Complete a humanized adaptive voice interview with follow-up questions.
- Practise a direct DSA problem in the integrated coding editor.
- Track MCQ, coding, and interview performance across sessions.
- Download a candidate coaching report.

### Employer workspace

- Convert a job description into a structured role profile.
- Create and publish a configurable assessment.
- Invite candidates and review their submitted attempts.
- Review knowledge, coding, interview, and integrity evidence separately.
- Avoid automatic hiring decisions or misleading composite scores.

## Typical workflow

1. Create a verified Student or Employer account.
2. Upload a resume and job description.
3. RoleQ parses the documents in memory.
4. OpenAI produces a structured, source-grounded competency analysis.
5. The candidate starts a complete assessment or goes directly to an AI
   interview.
6. The platform records round-level evidence, gaps, and coaching.
7. Results appear in performance views and downloadable reports.

## Technology stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| UI and editor | Lucide icons, custom RoleQ SVG design system, Monaco Editor |
| Authentication | Supabase email/password authentication with email verification |
| Backend | Python 3.12, FastAPI, Pydantic, SQLModel |
| Database | PostgreSQL 17 with Alembic migrations; SQLite for isolated tests |
| AI analysis | OpenAI Responses API, GPT-5.5, Pydantic Structured Outputs |
| Voice interview | OpenAI Realtime API with browser audio and transcript fallback |
| Code execution | Judge0 adapter with eight supported programming languages |
| Document parsing | PyPDF and python-docx for PDF, DOCX, and TXT |
| Proctoring prototype | Browser camera, microphone, display capture, fullscreen and integrity-event APIs |
| Testing | Pytest, ESLint, Next.js production build |

## Architecture

```text
Browser / Next.js
  ├── Supabase Auth
  ├── Resume Intelligence UI
  ├── Monaco coding environment
  ├── Realtime voice interview
  └── Camera and display capture
             │
             ▼
FastAPI application
  ├── Document parsing
  ├── OpenAI structured analysis
  ├── Assessment and interview orchestration
  ├── Judge0 execution adapter
  ├── Evidence and report generation
  └── SQLModel repositories
             │
             ▼
      PostgreSQL / SQLite tests
```

The application state machine controls assessment progression. AI models
generate and evaluate structured content but cannot independently change
rounds, reject a candidate, or make a hiring decision.

## Privacy and responsible use

- Resume and job-description files are parsed in memory.
- Original documents and full extracted text are not persisted.
- Saved analyses contain structured requirements, short evidence excerpts,
  gaps, suggestions, and resources.
- The full highlighted resume preview exists only during the current analysis
  session.
- Proctoring events are explainable evidence flags for human review.
- RoleQ does not infer identity, emotion, intent, or guilt.
- Reports do not contain an automatic hiring recommendation, integrity score,
  or composite candidate score.

## Local setup

### Prerequisites

- Node.js 20 or newer
- Python 3.12
- PostgreSQL 17 or Docker
- A Supabase project with email/password authentication
- An OpenAI API key
- Judge0 access for live code execution

### Installation

```powershell
Copy-Item .env.example .env
docker compose up -d postgres
powershell -ExecutionPolicy Bypass -File scripts/bootstrap.ps1

Set-Location services/api
..\..\.venv\Scripts\python.exe -m alembic upgrade head
Set-Location ../..

& 'C:\Program Files\nodejs\npm.cmd' run dev
```

Open:

- Web application: [http://localhost:3000](http://localhost:3000)
- FastAPI documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

If PostgreSQL is unavailable, omitting `DATABASE_URL` enables the local SQLite
fallback.

## Deployment

RoleQ is deployed as a Vercel multi-service project: Next.js at `/` and FastAPI
at `/_/api`. Supabase provides authentication and is the recommended persistent
PostgreSQL provider. Follow [DEPLOYMENT.md](DEPLOYMENT.md) for production
environment variables and authentication callback configuration.

## Environment configuration

Copy `.env.example` to `.env` and configure:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_REALTIME_MODEL`
- `JUDGE0_URL` and optional credentials
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL`

Never expose the Supabase service-role key or permanent OpenAI key in the
browser.

### Supabase settings

1. Enable email/password authentication.
2. Keep **Confirm email** enabled.
3. Set the Site URL to `http://localhost:3000`.
4. Add `http://localhost:3000/auth/callback` to Redirect URLs.
5. Enable CAPTCHA protection for public registration where appropriate.

## Tests

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run lint
& 'C:\Program Files\nodejs\npm.cmd' run build
powershell -ExecutionPolicy Bypass -File scripts/test-api.ps1
```

## Prototype scope

RoleQ is a functional prototype rather than a production hiring decision
system. Production deployment would additionally require security hardening,
formal privacy review, accessibility testing, monitoring, abuse prevention,
retention enforcement, and legal review for the intended jurisdictions.
