# Dev Handover

## Project
- Name: `JSC MECHFAB PRODUCTION SYSTEM`
- Stack: Next.js + TypeScript + Tailwind + Prisma + PostgreSQL/Supabase
- Main app root: this folder (`jsc-mechfab-production-v6`)

## Environment
Create `.env` with at least:
- `DATABASE_URL`
- `JWT_SECRET`
- `NEXTAUTH_SECRET` (if used by your auth utilities)
- Any project-specific vars from `.env.example`

## Setup
Run in order:

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## Runtime Notes
- App default local URL: `http://localhost:3000`
- Login page: `/login`
- Dashboard: `/dashboard`
- Project detail: `/project/[id]`

## Production-Safe Rules
- Keep CLIENT role view-only.
- Keep admin role checks in APIs.
- Keep service layer as source of business logic.
- Do not bypass soft delete strategy.
- Do not remove tenant filtering.

## Change Strategy
- UI polish: safe.
- Auth rewrites: high risk; require migration plan.
- Prisma schema edits: only when unavoidable; validate existing data compatibility.

## Validation Checklist Before Merge
- App boots with no runtime errors.
- Login works for ADMIN and CLIENT.
- CLIENT cannot see/perform write actions.
- Project creation works without manual date input.
- Drawing timeline still computes expected completion correctly.
