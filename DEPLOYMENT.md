# Deploy RoleQ

The current hosted demo uses:

- **Vercel multi-service** for the Next.js frontend and FastAPI backend.
- **Supabase** for authentication and PostgreSQL.
- **OpenAI** for resume matching and interviews.
- **Judge0** for code execution.

## 1. Push the repository to GitHub

The hosting providers deploy from a Git repository. Create a private or public
GitHub repository and push this project. Never commit `.env`.

## 2. Obtain the Supabase database URL

In Supabase, open **Project Settings → Database → Connection string** and copy
the SQLAlchemy-compatible transaction-pooler URL. Replace the password
placeholder with the database password.

The URL normally begins with:

```text
postgresql+psycopg://
```

If Supabase provides `postgresql://`, change only the scheme to
`postgresql+psycopg://`.

## 3. Deploy the Vercel multi-service project

Vercel detects:

- Next.js under `apps/web`, routed at `/`.
- FastAPI under `services/api`, routed at `/_/api`.

Link the repository and run:

```powershell
vercel deploy --prod
```

Configure these production variables in Vercel:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `/_/api` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `DATABASE_URL` | Supabase Postgres connection URL |
| `OPENAI_API_KEY` | OpenAI project API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `CORS_ORIGINS` | Exact Vercel production origin |
| `JUDGE0_AUTH_TOKEN` | Optional managed Judge0 token |

Verify `https://YOUR-PROJECT.vercel.app/_/api/health`.

### Persistent data and artifacts

Do not use SQLite or `/tmp` storage for production persistence. Configure the
Supabase PostgreSQL `DATABASE_URL`. Store camera/screen recordings in private
object storage such as Supabase Storage or Vercel Blob.

## 5. Complete cross-origin and authentication settings

Set `CORS_ORIGINS` to the exact Vercel origin:

```text
https://YOUR-PROJECT.vercel.app
```

In Supabase Authentication URL Configuration:

- Set **Site URL** to `https://YOUR-PROJECT.vercel.app`.
- Add `https://YOUR-PROJECT.vercel.app/auth/callback` to Redirect URLs.
- Keep the localhost callback for local development if needed.

In Supabase Authentication email settings:

- Keep **Confirm email** enabled.
- Configure a **custom SMTP provider** before allowing public signups.
- Use a verified sender address/domain and enter the provider's SMTP host,
  port, username, password, and sender details in Supabase.
- Do not place SMTP credentials in frontend or `NEXT_PUBLIC_*` variables.

Supabase's default email service is intended only for testing, accepts a
restricted recipient list, and has a very low sending limit. It cannot support
public RoleQ registrations.

Redeploy Vercel after changing production variables.

## 6. Production smoke test

Verify:

1. Landing page and logo load over HTTPS.
2. Signup email redirects to the deployed callback.
3. Student and Employer accounts reach the correct dashboard.
4. Resume Intelligence returns an OpenAI evidence match.
5. Interview microphone/camera/display permissions work.
6. Realtime audio connects.
7. Code execution reaches Judge0.
8. Reports download successfully.

## 7. Add the public demo link

Replace the placeholder in `README.md` with the Vercel URL or a recorded demo.
