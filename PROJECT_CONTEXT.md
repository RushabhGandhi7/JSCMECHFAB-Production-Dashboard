# JSC MECHFAB PRODUCTION SYSTEM - Project Context

## System Overview
- Production ERP for mechanical manufacturing project execution.
- Primary users: `ADMIN` (full control) and `CLIENT` (view-only tenant access).
- Main workflow: create project -> receive drawing -> auto 28-day completion window -> track stage progress -> soft delete if needed.

## Architecture
- Framework: Next.js + TypeScript + Tailwind.
- UI structure:
  - `app/dashboard/page.tsx` = main production dashboard (v2 base).
  - `app/project/[id]/page.tsx` = project detail + stage controls.
  - `app/login/page.tsx` = login.
  - `components/UserMenu.tsx` = sticky top navbar (dashboard/users/clients/user dropdown).
- API structure: `pages/api/*` (Pages Router APIs), not `app/api`.
- Business/data orchestration in service layer: `lib/services/*`.
- API utility wrappers: `lib/api.ts` response/validation/auth guards.

## Database Design
- Prisma schema in `prisma/schema.prisma`.
- Main models:
  - `User`: auth identity, `role`, tenant link (`clientId`) + legacy `clientName`.
  - `Client`: tenant/master account.
  - `Project`: project header, timeline fields, soft delete flags, status.
  - `ProductionStage` + `ProjectStage`: weighted progress model.
  - `ActivityLog`: audit/action trail.
- Key compatibility fields:
  - `clientId` with fallback `clientName` for legacy compatibility.
  - `isDeleted` + `deletedAt` for soft delete behavior.

## Auth and Permissions
- Session-based API auth via `lib/auth.ts` and `/api/auth/*`.
- Role definitions:
  - `ADMIN`: create/update/delete projects, manage users/clients.
  - `CLIENT`: read-only, tenant-scoped project visibility.
- Enforcement happens in both:
  - UI visibility (hide create/edit actions for CLIENT).
  - API role checks (server-side hard enforcement).

## Critical Security Rules
- CLIENT is strictly view-only.
- Admin-only writes are enforced in project/user/client endpoints.
- Client data visibility is filtered by tenant scope (`clientId`/`clientName`).
- No bypass of service layer role checks.

## Project Flow
- Project creation (`POST /api/projects`):
  - Inputs: `projectNo`, `clientId`, `equipmentType` (used as description in UI).
  - Timeline fields:
    - project created time = DB `createdAt` (system time).
    - `drawingReceivedDate` = null on create.
    - `expectedCompletionDate` = null on create.
- Drawing update (`PATCH /api/project`):
  - If drawing is set, expected completion auto-computes to drawing + 28 days.
  - If drawing is cleared, expected completion resets to null.
- Status behavior:
  - No drawing -> waiting for drawing (timeline view).
  - Overdue/stage delay -> delayed.
  - Full progress -> completed.
  - Otherwise planning/in production by weighted stage progress.

## Features Implemented

### v2 Base Features
- White industrial dashboard UI and KPI cards.
- Project list and project detail stage tracking.
- Soft delete and trash support.
- Role-based user/client management screens.

### v5 Features Carried Forward
- Selective top-right navigation pattern integrated cleanly:
  - Dashboard
  - Users (admin only)
  - Clients (admin only)
  - User dropdown with role/email/logout

## Known Risks and Edge Cases
- Legacy dual tenant keys (`clientId` + `clientName`) must stay compatible.
- `equipmentType` is currently used as project description display text.
- `orderDate`/`deliveryDate` remain in schema for compatibility; creation now sets system values, not user input.
- v5 pages still exist for compatibility/reference; avoid coupling new production logic to old experimental UI.

## Do Not Break Rules
- Do not remove tenant client filtering.
- Do not allow CLIENT write operations.
- Do not bypass service layer for DB writes.
- Do not replace soft delete with hard delete.
- Do not refactor auth/session flow without explicit migration plan.
