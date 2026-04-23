# LLM Rules - JSC MECHFAB Production

## Never Do
- Never change auth/session architecture unless explicitly requested.
- Never allow `CLIENT` role to create, update, or delete.
- Never remove server-side validation/role checks.
- Never duplicate business logic outside `lib/services/*`.
- Never hard-delete projects that are part of production history.

## Always Do
- Always route DB write behavior through service layer modules.
- Always enforce role checks in API handlers even if UI hides controls.
- Always return API responses in `{ success, data, message }` shape.
- Always preserve legacy compatibility (`clientId` + `clientName` fallback).
- Always keep changes production-safe and backward-compatible.

## Coding Rules
- Keep modules focused and reusable.
- Prefer additive changes over breaking refactors.
- Keep UI clean, white industrial theme.
- Avoid date manual-entry patterns for project creation flow.
- Ensure CLIENT experience remains strictly read-only.
