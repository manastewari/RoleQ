# Deploy RoleQ

This deployment uses:

- **Vercel** for the Next.js frontend.
- **Render** for the FastAPI backend.
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

## 3. Deploy the FastAPI backend on Render

1. In Render, choose **New → Blueprint**.
2. Connect the GitHub repository.
3. Render detects `render.yaml`.
4. Enter the secret environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection URL |
| `OPENAI_API_KEY` | OpenAI project API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `CORS_ORIGINS` | Temporarily use the planned Vercel URL or update after step 4 |
| `JUDGE0_AUTH_TOKEN` | Optional managed Judge0 token |

The Render service runs Alembic migrations automatically before starting.

After deployment, verify:

```text
https://YOUR-RENDER-SERVICE.onrender.com/health
```

### Proctoring artifact storage

The default Blueprint stores camera/screen artifacts under `/tmp`, which is
appropriate for a demonstration but is not persistent across service restarts.
For durable recordings, attach a Render persistent disk and change
`STORAGE_DIR` to its mount path, or replace local storage with a private object
storage bucket before production use.

## 4. Deploy the Next.js frontend on Vercel

1. In Vercel, choose **Add New → Project**.
2. Import the same GitHub repository.
3. Keep the repository root as the project root; `vercel.json` supplies the
   monorepo build settings.
4. Add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | Render backend URL without a trailing slash |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |

Deploy and copy the resulting `https://...vercel.app` URL.

## 5. Complete cross-origin and authentication settings

Update the Render `CORS_ORIGINS` variable to the exact Vercel origin:

```text
https://YOUR-PROJECT.vercel.app
```

In Supabase Authentication URL Configuration:

- Set **Site URL** to the Vercel URL.
- Add `https://YOUR-PROJECT.vercel.app/auth/callback` to Redirect URLs.
- Keep the localhost callback for local development if needed.

Redeploy Render after changing CORS.

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
