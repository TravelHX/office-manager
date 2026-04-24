# Phase 19: Admin provisioning and first-access (technical notes)

## Lifecycle

1. **Provisioned**: Admin creates a user with email and name only. `password_hash` is NULL, `profile_complete` is FALSE, and a time-limited `invitation_token` is stored (default expiry: 168 hours).

2. **Active**: User opens the profile setup URL, sets password and office location via `POST /api/auth/complete-profile`. The invitation token is cleared and `profile_complete` becomes TRUE.

## First-access path

Email delivery is not implemented in this repository. After admin creation, the API returns `invitationToken` and `profileSetupUrl` so the administrator can share the link out-of-band (email, chat, etc.).

Public endpoints:

- `GET /api/auth/provision/validate?token=...` — validates token and returns email when valid.
- `POST /api/auth/complete-profile` — body: `token`, `password`, `office_location`.

Login uses email as username (normalized to lowercase in the database for new provisioned and newly registered users).

## Access control

Authenticated users with `profile_complete = FALSE` cannot call booking, desk, parking, admin, matrix, or version-mutation APIs. They are not issued a JWT until they complete the invitation flow (password set), so this state is mainly defensive for inconsistent data.

## Migration

Existing rows receive `profile_complete` DEFAULT TRUE when the column is added. `password_hash` is altered to NULLable so provisioned users can exist without a password until completion.
