# Weigh Feeder Production Control System

Production timeline controller for manufacturing: drawing receipt drives a **28-day expected completion window**, stage progress is tracked on one control panel, and delays surface automatically.

## Stack
- Next.js App Router + TypeScript
- Next.js API routes
- PostgreSQL (local or **Supabase**) + Prisma
- Email/password authentication with role-based access
- Tailwind CSS

## Supabase setup
1. In the Supabase dashboard, copy the **direct** Postgres URI (port **5432**).
2. Put it in `.env` as `DATABASE_URL` (never commit real passwords).
3. Sync schema: `npx prisma db push`
4. Generate client: `npm run prisma:generate`
5. Seed: `npx prisma db seed`

If you ever pasted a database password in an insecure channel, **rotate the password** in Supabase.

## Local setup
1. Copy `.env.example` to `.env` and set variables.
2. `npm install`
3. `npm run prisma:generate`
4. `npx prisma db push` (or `npm run prisma:migrate` for migration-based workflows)
5. `npm run prisma:seed`
6. `npm run dev`

## Default users
- Admin: `admin@wfpcs.local` / `admin123`
- Viewer: `viewer@wfpcs.local` / `viewer123`

## API routes
- `GET/POST /api/projects`
- `GET /api/projects/:id`
- `PATCH /api/project` — update `drawingReceivedDate` (sets `expectedCompletionDate` = received + 28 days)
- `PATCH /api/project-stage`

## Business rules (timeline)
- When `drawingReceivedDate` is set, `expectedCompletionDate` is set to that date **+ 28 days** (stored on the project).
- `daysRemaining` = calendar days from today (UTC) to `expectedCompletionDate`.
- If `daysRemaining < 0` **or** any stage is delay-flagged, project `status` becomes **DELAYED** (unless overridden by completion rule: completion still wins when not delayed — see `deriveProjectStatus` in `lib/services/project.service.ts`).

## Production safeguards
- Zod validation on write endpoints
- API shape: `{ success, data?, message? }`
- Service layer under `lib/services`
- Prisma singleton in `lib/prisma.ts` (avoids exhausting connections in dev)
- Activity logging on project timeline and stage updates
- Rate limiting + structured logs on API routes

## Environment variables
- `DATABASE_URL` (required) — Supabase or any Postgres
- `SESSION_SECRET` (required, min length 16)
- `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` (optional)

## Backup
- Use Supabase backups plus `pg_dump` before major schema changes.
