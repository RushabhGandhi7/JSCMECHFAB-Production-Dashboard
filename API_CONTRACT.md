# API Contract

Base response shape:
- Success: `{ success: true, data, message? }`
- Error: `{ success: false, message }`

## Auth

### `POST /api/auth/login`
- Auth: No
- Input: `{ email, password }`
- Output: session set, success payload
- Roles: public endpoint

### `POST /api/auth/logout`
- Auth: Yes
- Input: none
- Output: success payload, session cleared
- Roles: `ADMIN`, `CLIENT`

### `GET /api/auth/me`
- Auth: Yes
- Input: none
- Output: current user profile `{ id, email, role, clientName, clientId? }`
- Roles: `ADMIN`, `CLIENT`

## Projects

### `GET /api/projects`
- Auth: Yes
- Input: none
- Output: project list with metrics
- Roles:
  - `ADMIN`: all non-deleted projects
  - `CLIENT`: tenant-filtered non-deleted projects only

### `POST /api/projects`
- Auth: Yes
- Input: `{ projectNo, clientId, equipmentType }`
- Output: created project with stages/metrics
- Roles: `ADMIN` only

### `GET /api/projects/[id]`
- Auth: Yes
- Input: path `id`
- Output: project detail + stages + metrics
- Roles:
  - `ADMIN`: unrestricted
  - `CLIENT`: same-tenant only

### `DELETE /api/projects/[id]`
- Auth: Yes
- Input: path `id`
- Output: soft-deleted project
- Roles: `ADMIN` only

### `POST /api/projects/[id]/restore`
- Auth: Yes
- Input: path `id`
- Output: restored project
- Roles: `ADMIN` only

### `PATCH /api/project`
- Auth: Yes
- Input: `{ id, updatedAt, drawingReceivedDate }`
- Output: updated project + recalculated expected completion
- Roles: `ADMIN` only

### `PATCH /api/project-stage`
- Auth: Yes
- Input: `{ id, updatedAt, progress?, status?, plannedDate?, actualDate?, delayReason? }`
- Output: updated stage and project status effects
- Roles: `ADMIN` only

## Clients

### `GET /api/clients`
- Auth: Yes
- Input: none
- Output: client list
- Roles: `ADMIN` only

### `POST /api/clients`
- Auth: Yes
- Input: `{ name }`
- Output: created client
- Roles: `ADMIN` only

### `PATCH /api/clients/[id]`
- Auth: Yes
- Input: `{ name }`
- Output: updated client
- Roles: `ADMIN` only

### `DELETE /api/clients/[id]`
- Auth: Yes
- Input: path `id`
- Output: deleted client when dependency checks pass
- Roles: `ADMIN` only

## Admin Users

### `GET /api/admin/users`
- Auth: Yes
- Input: none
- Output: users list
- Roles: `ADMIN` only

### `POST /api/admin/users`
- Auth: Yes
- Input: admin/user creation payload
- Output: created user
- Roles: `ADMIN` only

### `DELETE /api/admin/users/[id]`
- Auth: Yes
- Input: path `id`
- Output: deletion result
- Roles: `ADMIN` only (self-delete blocked)

### `POST /api/admin/create-user`
- Auth: Yes
- Input: user creation payload (legacy admin endpoint)
- Output: created user
- Roles: `ADMIN` only

## Health

### `GET /api/health`
- Auth: No
- Input: none
- Output: service health payload
