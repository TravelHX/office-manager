# Audit Event Catalogue

## Document purpose

This file lists every audit event the application emits. It is the
contract between the **audit event store** (Phase 21a: schema + model + repository +
service) and the **emission wiring** (Phase 21d: each HTTP route calls
`AuditService.logEvent` via `src/backend/utils/audit-helper.js`).

Emission wiring was delivered in Phase 21d (tasks 21.6-21.11). Every row in
the **Event type table** below now maps to a live emission site. Proof lives
in `tests/integration/audit-emissions.test.js`, which hits each route end
to end and asserts the resulting audit row.

## Relationship to spec

See `docs/spec.md` section 15 for the high-level requirement. This file is the
concrete instantiation of that section: stable machine-readable action codes,
their triggers, the actor attribution rule, and the payload fields that must be
captured.

## Event shape (all events)

Every row in `audit_events` has these columns (see `src/sql/08-audit-events-schema.sql`):

| Column        | Type            | Notes                                                                 |
|---------------|-----------------|-----------------------------------------------------------------------|
| `id`          | BIGINT PK       | Auto-increment.                                                       |
| `occurred_at` | TIMESTAMP       | Defaults to `CURRENT_TIMESTAMP`; server-issued, not trusted from client. |
| `actor_id`    | INT NULL        | `users.id` at the time of the action. No FK (audit is independent of user lifecycle). |
| `actor_email` | VARCHAR(255)    | Snapshot of the actor's email at the time of the action, so deleted users remain identifiable. |
| `action_type` | VARCHAR(64)     | Stable machine-readable code from the table below. Never reused.      |
| `target_type` | VARCHAR(64) NULL| e.g. `booking`, `parking_reservation`, `user`, `desk`, `parking_space`, `admin_config`. |
| `target_id`   | INT NULL        | Primary key of the target row at the time of the action.              |
| `summary`     | VARCHAR(512) NULL| Short human-readable description, safe to show in admin UI.          |
| `payload`     | JSON NULL       | Structured context. **Must not** contain secrets (no passwords, no full tokens, no password hashes). |
| `ip_address`  | VARCHAR(45) NULL| IPv4 or IPv6 (max 45 chars). Captured from request if available.      |

### Actor rules

- **Authenticated user action:** `actor_id` = the authenticated user's id, `actor_email` = their email at time of action.
- **Admin-on-behalf action:** `actor_id` = the **admin** who performed the action; `target_type`/`target_id` point at the affected entity (e.g. the cancelled booking or the deleted user). The affected user's id is recorded in `payload` when relevant (e.g. `{ "deleted_user_id": 42 }`).
- **Unauthenticated / system action:** `actor_id` = NULL, `actor_email` = NULL (e.g. startup cleanup, anonymous registration preamble).

## Event type table

Legend for **Actor**: *self* = the authenticated user performing their own action; *admin* = an admin acting on behalf of or against another user; *system* = unauthenticated or startup code path.

| `action_type`                             | Trigger (HTTP route / service method)                         | Actor  | `target_type`         | Required `payload` keys                                  |
|-------------------------------------------|---------------------------------------------------------------|--------|-----------------------|----------------------------------------------------------|
| `AUTH_LOGIN_SUCCESS`                      | `POST /api/auth/login` (200 response)                         | self   | (none)                | (none beyond `ip_address` column)                        |
| `AUTH_LOGIN_FAILURE`                      | `POST /api/auth/login` (401/403 response)                     | system | (none)                | `attempted_email`                                        |
| `AUTH_LOGOUT`                             | `POST /api/auth/logout`                                       | self   | (none)                | (none)                                                   |
| `DESK_BOOKING_CREATED`                    | `POST /api/bookings` (201)                                    | self   | `booking`             | `desk_id`, `start_date`, `end_date`                      |
| `DESK_BOOKING_BULK_CREATED`               | `POST /api/bookings/bulk` (201/207)                           | self   | (none)                | `desk_ids`, `start_date`, `end_date`, `successful_count`, `failed_count` |
| `DESK_BOOKING_CANCELLED_BY_USER`          | `DELETE /api/bookings/:id` by the booking's owner             | self   | `booking`             | `desk_id`, `start_date`, `end_date`                      |
| `DESK_BOOKING_CANCELLED_BY_ADMIN`         | `DELETE /api/admin/bookings/:id`                              | admin  | `booking`             | `booking_user_id`, `desk_id`, `reason`                   |
| `PARKING_RESERVATION_CREATED`             | `POST /api/parking-reservations` (201)                        | self   | `parking_reservation` | `parking_space_id`, `reservation_date`, `time_period`    |
| `PARKING_RESERVATION_BULK_CREATED`        | `POST /api/parking-reservations/bulk` (201/207)               | self   | (none)                | `parking_space_ids`, `reservation_date`, `time_period`, `successful_count`, `failed_count` |
| `PARKING_RESERVATION_CANCELLED_BY_USER`   | `DELETE /api/parking-reservations/:id` by the reservation's owner | self | `parking_reservation` | `parking_space_id`, `reservation_date`, `time_period`   |
| `PARKING_RESERVATION_CANCELLED_BY_ADMIN`  | `DELETE /api/admin/parking-reservations/:id`                  | admin  | `parking_reservation` | `reservation_user_id`, `parking_space_id`, `reason`      |
| `ADMIN_CONFIG_UPDATED`                    | `PUT /api/admin/config` (desk_count / parking_count change)   | admin  | `admin_config`        | `changed_keys`, `before`, `after`                        |
| `DESK_CONFIG_UPDATED`                     | Desk add/remove/rename via admin (desk-count change or manual desk edit) | admin | `desk`       | `change` (`created` / `deleted` / `renamed`), `desk_number` |
| `PARKING_CONFIG_UPDATED`                  | Parking space add/remove/rename via admin                     | admin  | `parking_space`       | `change`, `space_number`                                 |
| `USER_CREATED`                            | `POST /api/auth/register` (first user) OR admin provisioning path | self/admin | `user`          | `created_user_id`, `created_email`, `is_admin`           |
| `USER_DELETED`                            | `DELETE /api/auth/users/:id` (always admin, never self)       | admin  | `user`                | `deleted_user_id`, `deleted_email`                       |
| `USER_PASSWORD_CHANGED`                   | Self-service password change or admin-initiated reset         | self/admin | `user`            | `target_user_id`, `initiator` (`self` or `admin`)        |
| `USER_PROFILE_COMPLETED`                  | Profile completion after admin provisioning (first login)     | self   | `user`                | `office_location`                                        |

### Explicitly out of scope for Phase 21

- **Overtime events.** The overtime feature was removed end-to-end in Phase 23a (spec section 16). No `OVERTIME_*` events exist or are planned.
- **Read-only access.** Viewing bookings, viewing the matrix, and similar read operations do **not** emit audit events. Only state-changing actions are captured.

## Retention

No retention policy is enforced in Phase 21a. Rows accumulate indefinitely. A later task will either:

- add a configurable `AUDIT_RETENTION_DAYS` with a scheduled purge job, or
- document an operator-run SQL tool for truncation.

Either way, any administrative purge must itself be auditable (spec section 15: *"Any administrative purge should itself be auditable or strictly controlled."*).

## Append-only guarantee

`AuditEventRepository` rejects `update` and `delete` with an explicit error. There is no UI path, no API path, and no service path to edit or delete an audit row. Direct SQL access (operator tooling) is the only mechanism.

## Payload hygiene

Emitters **must not** place in `payload`:

- password values or hashes
- full authentication tokens (JWT, reset tokens) — log only a hash prefix if absolutely needed
- data the actor would not reasonably expect to be visible to administrators

If in doubt, store a short `summary` and omit the payload.
