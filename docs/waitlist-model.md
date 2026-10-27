# Waitlist data model

## Scope

The initial migration creates `WaitlistEntry` and `WaitlistOrderChange`. Public registration is implemented as described in [the registration API](waitlist-registration.md). A development-only [internal overview and group assignment](waitlist-administration.md) is also available. Registration receipts and status-link emails use the shared [email delivery service](email-delivery.md). Production authorization remains a separate step. Use synthetic data until authentication, authorization, and the public privacy information are implemented.

## Registration fields

Each entry represents the swimming person, with `firstName`, `lastName`, `birthDate`, and a contact `email`. No separate contact-person name is collected. Birth dates use PostgreSQL `DATE`; registration and modification timestamps use `TIMESTAMPTZ`. `registeredAt` records the original registration time and must not change on group transfers or manual reordering.

Required selections are stored as PostgreSQL enum arrays:

| Field          | Technical value | German label  |
| -------------- | --------------- | ------------- |
| Badge          | `SEAHORSE`      | Seepferdchen  |
| Badge          | `DSA_BRONZE`    | DSA Bronze    |
| Badge          | `DSA_SILVER`    | DSA Silber    |
| Badge          | `DSA_GOLD`      | DSA Gold      |
| Swimming style | `BUTTERFLY`     | Schmetterling |
| Swimming style | `BACKSTROKE`    | Rücken        |
| Swimming style | `BREASTSTROKE`  | Brust         |
| Swimming style | `FREESTYLE`     | Kraul         |

Both arrays must contain at least one non-null selection. Higher badges satisfy the minimum badge requirement; selecting Seepferdchen in addition is not necessary. These fields record the reported qualifications, not an award history.

`message` is the optional public message. `internalNotes` is a separate optional internal field and must never appear in public status responses. The email is intentionally not unique; duplicate registrations and siblings sharing a contact email are permitted for now.

The third migration adds nullable, unique `statusTokenHash` with a hexadecimal format constraint. Existing entries and new registrations have null hashes until first link delivery preparation. Only a SHA-256 hash of a 32-byte random bearer token is stored. See [status-token lifecycle and API](waitlist-status-tokens.md); the hash is absent from all overview/detail responses.

The fourth migration adds status-link delivery state, the current attempt ID/time, and confirmed SMTP acceptance time. A CHECK constraint enforces their consistency. No plaintext token or SMTP error is persisted; see [delivery and manual recovery](waitlist-status-link-delivery.md).

## Groups and statuses

`SwimmingGroup` has four fixed values, `GROUP_1` through `GROUP_4`. Group 4 is the beginner group. New registrations are not assigned automatically; they start as `UNASSIGNED` with no group or ordering key. Each entry can have at most one group.

Status values are `UNASSIGNED`, `WAITING`, `INVITED`, `TRIAL_COMPLETED`, `ACCEPTED`, and `CANCELLED`. Only `WAITING` entries participate in the queue. A waiting entry requires a group and a positive `queueOrder`; other statuses must have a null ordering key. An unassigned entry must have a null group. The future service layer will validate permitted status transitions.

## Ordering and history

The second migration adds `WaitlistGroupChange` with previous group (null for initial assignment), new group, and timestamp. Assignment and transfer append history within their queue transaction. The internal timeline combines these records with `registeredAt` and existing `WaitlistOrderChange` records. Missing older group-assignment timestamps remain explicitly unknown. Deletion cascades to both kinds of history; future lifecycle events are implemented with their corresponding features.

`queueOrder` is an internal integer ordering key, not the displayed waiting position. A group's waiting entries are sorted by this key; their displayed positions are numbered from 1. Gaps in ordering keys do not produce gaps in waiting positions. Keys are unique per group.

The assignment service inserts people according to their original `registeredAt`, including after group transfers. For equal timestamps, it uses `id` as a deterministic tie-breaker. Existing entries retain their relative order, including manual changes: insert before the first entry with a later registration date, otherwise append. Group transfers and new insertions reconcile the affected queues transactionally.

Each manual move requires a `WaitlistOrderChange` containing the group, previous and new displayed positions, a nonblank reason, and a creation timestamp. This history is separate from freely editable internal notes. Positions must be positive and different.

The manual-move service updates ordering and inserts the history record in one transaction, protects concurrent queue edits with the shared advisory lock, and requires a reason. For multi-row reordering, it uses temporary unused positive keys before assigning final keys to avoid collisions with the unique index. The schema alone does not force every direct SQL ordering update to create history. The internal API and stale-view checks are described in [internal administration](waitlist-administration.md).

Actor references will be added with the application's own user model and authorization. Until then, no real-user action attribution is claimed. Deleting an entry cascades to its ordering history; retention rules and deletion workflows remain to be decided before public operation.

## Database constraints and application validation

The migration adds SQL CHECK constraints for nonblank required text, nonempty enum selections, queue/status consistency, nonblank reorder reasons, and valid old/new positions. These constraints are maintained in migration SQL because Prisma schema syntax does not represent them.

The registration API validates email syntax, valid birth dates not in the future, and distinct multi-select values. Future administration APIs must also validate status transitions and access permissions. Database constraints complement application validation; they do not replace it.

## Verification

```powershell
npm.cmd run prisma:migrate:deploy
npm.cmd run db:verify:waitlist
```

The verification builds the backend and exercises valid registration, repeated email addresses, queue ordering, history, status changes, and rejected invalid records against PostgreSQL. Every synthetic record is rolled back. Run it against a development or isolated test database, not production.

GitHub Actions starts a temporary PostgreSQL service, applies the committed migration, and runs the same verification after the ordinary quality checks. Local `npm.cmd run check` remains database-independent; `db:verify:waitlist` requires a running database with migrations applied.

The public status API, backend-only token issuance, and [public status page](waitlist-status-page.md) are implemented. The [first group-assignment email](waitlist-status-link-delivery.md) persists delivery state and supports manual recovery. Trial invitations and responses, authentication, and authorization are separate implementation steps.
