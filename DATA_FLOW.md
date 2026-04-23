# Data Flow

## Standard Flow
- UI (React page/component) -> API route (`pages/api/*`) -> Service (`lib/services/*`) -> Prisma -> DB -> normalized API response.

## Project Creation Flow
1. Admin submits dashboard create bar (`projectNo`, `project description`, `client`).
2. UI calls `POST /api/projects`.
3. API validates with Zod (`createProjectSchema`) and checks role (`ADMIN` only).
4. `createProject()` service:
   - resolves client.
   - creates project with system timestamps.
   - initializes default production stages.
   - writes activity log.
5. API returns created project payload; UI refreshes list.

## Drawing Timeline Flow
1. Admin uses quick update controls in project detail.
2. UI calls `PATCH /api/project` with optimistic lock `updatedAt`.
3. Service computes:
   - `drawingReceivedDate` from payload.
   - `expectedCompletionDate = drawingReceivedDate + 28 days` (or null if cleared).
4. Service logs activity and recomputes project status.
5. UI reloads and reflects updated timeline metrics.

## Stage Update Flow
1. Admin selects stage + progress/status/delay reason.
2. UI calls `PATCH /api/project-stage`.
3. Service updates stage, recomputes project status.
4. UI refreshes detail + dashboard aggregates.

## Client Filtering Logic
- For `CLIENT` role, list/read queries include tenant scope:
  - preferred `clientId`.
  - legacy fallback `clientName` where needed.
- This prevents cross-tenant visibility even if UI is manipulated.

## User Management Flow
- Admin screens call `/api/admin/users*`.
- API enforces admin-only role checks.
- Service/handler validates payload and writes via Prisma.

## Soft Delete Flow
- Admin delete action calls `DELETE /api/projects/[id]`.
- Project is marked `isDeleted = true`, not hard-removed.
- Restore endpoint can reactivate when needed.
