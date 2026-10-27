# Internal waitlist administration

## Development access

The Angular page `/intern/warteliste` lists registrations and allows group assignment, internal notes, and manual queue changes. All internal API routes require exactly `NODE_ENV=development` and `ENABLE_DEV_WAITLIST_ADMIN=true` in the backend environment. Missing settings and all other values return HTTP 404 before database access. Production is blocked even if the opt-in is true. The example environment keeps the flag false; the existing local environment is not modified automatically.

The page starts on the unassigned tab, with cards for direct group assignment. Each of the four group tabs shows a table of waiting entries, ordered by server-calculated position. Tab counts include only `WAITING` entries; other statuses do not appear in these tables. Columns show status, position, name, age, and badges. Age is calculated from the birth date against the browser's current local calendar date; leap-day birthdays advance on March 1 in non-leap years.

Opening a name displays the full record with previous/next navigation in the selected group's queue order. Returning to the table preserves the selected tab. Navigation stops at each end of the list. A group transfer removes the record from that group's view and returns to its table after reloading. Detail selection and tabs are local component state, not bookmarkable routes. Table pagination and filters for other statuses are deferred.

This temporary guard is not user authentication or authorization. Anyone able to reach an enabled development server can use these endpoints. Only synthetic data belongs in this phase. Later, replace this guard with the application's backend authentication and explicit permissions; do not carry the opt-in into public operation.

## API

`GET /api/internal/waitlist` returns entries in original registration order, with ID as a tie-breaker. Each record includes the registration fields, registration timestamp, status, group, and `position`. Birth dates are `YYYY-MM-DD`; timestamps are ISO timestamps. Only `WAITING` entries count toward positions, numbered consecutively from 1 within each group. Other entries have a null position. Internal ordering keys, internal notes, and history are not included. The current MVP returns all records without pagination. Responses use `Cache-Control: no-store`.

`PATCH /api/internal/waitlist/:id/group` accepts:

```json
{ "group": "GROUP_4" }
```

IDs must be UUIDs and groups must be `GROUP_1` through `GROUP_4`. Extra properties are rejected. Success returns HTTP 200 with `{ "status": "assigned" }`; the frontend reloads the list so all displayed positions come from the backend. Unknown entries return 404; statuses other than `UNASSIGNED` and `WAITING` return 409. Invalid input returns 400.

## Queue updates

Assignment changes `UNASSIGNED` to `WAITING`. Changing a waiting entry's group preserves its original registration timestamp and updates both affected queues. Reassigning the same group is a no-op. No endpoint for clearing a group or changing other statuses is introduced.

Queue writes run in a PostgreSQL transaction. A shared transaction-scoped PostgreSQL advisory lock `(74102, 1)` serializes queue edits across backend instances. Every future queue-changing operation must take this same lock before reading queue state. This intentionally simple strategy serializes all four groups; finer-grained locks are unnecessary for this MVP.

The entry is inserted before the first entry with a later registration timestamp (or larger ID for equal timestamps); otherwise it is appended. Existing entries retain their relative order. The source and destination queues are resequenced using temporarily unused positive keys before final consecutive keys, avoiding the immediate unique constraint. No partial transfer is visible outside the transaction. Reads obtain entries in a single query and compute positions from that snapshot.

Manual reordering preserves the relative order of all other waiting entries. Subsequent assignments and transfers follow the insertion rule above and do not sort the whole queue chronologically again. A manually moved person's displayed position can still change when another person is inserted or leaves. Group-change history is recorded; acting-user attribution remains future work.

## Internal notes and manual moves

`GET /api/internal/waitlist/:id/details` loads `internalNotes`, a unified `history`, `groupHistoryIncomplete`, and `statusLinkDelivery` for the opened entry only. History is ordered by time descending, then ID descending. Types are `REGISTERED`, `GROUP_ASSIGNED`, `GROUP_CHANGED`, `POSITION_CHANGED`, and `STATUS_LINK_SENT`, with their group/position fields and move reason where applicable. Registration time comes from immutable `registeredAt`; group changes and manual moves use their stored records. Notes and history remain absent from the overview response and public registration response. Unknown IDs return 404. All internal responses use `Cache-Control: no-store`.

The additive migration creates `WaitlistGroupChange`. First assignments and transfers append a record in the same transaction as queue changes; same-group no-ops create none. Existing registrations and manual moves are shown using their preserved original timestamps. Earlier group assignments were not recorded, so no guessed timestamps or backfilled events are introduced. `groupHistoryIncomplete` marks assigned records whose initial group assignment is missing. Later lifecycle events will be added when those features are implemented; there is no generic event system or speculative invitation/email behavior.

`PATCH /api/internal/waitlist/:id/notes` accepts `{ "internalNotes": "Example note" }`. Notes are required strings, trimmed, and limited to 5,000 characters. Blank text clears the field to null. Success returns `{ "status": "saved" }`. Notes can be edited independently of status and do not change queue order or history. Concurrent note edits use last-write-wins; edit attribution and conflict detection are deferred.

`PATCH /api/internal/waitlist/:id/position` accepts:

```json
{
  "group": "GROUP_4",
  "previousPosition": 3,
  "position": 1,
  "reason": "Reason for prioritizing this entry"
}
```

Only `WAITING` entries can move, within their existing group. Both positions must be positive integers. The target must be different and within the group's current queue. The independent reason is trimmed, nonblank, and limited to 2,000 characters; internal notes never substitute for it. Extra properties are rejected. Success returns `{ "status": "moved" }`.

The service obtains the same advisory lock as group assignment before checking current group and displayed position. If these no longer match the request, it returns 409 without mutation. Invalid target positions return 400. Resequencing and `WaitlistOrderChange` creation share one transaction, so failure of either rolls back the entire move. The original registration timestamp remains unchanged. There is no user attribution yet because authentication is deferred.

The detail view provides a notes form and read-only lifecycle history. Manual moves are available only through a small change button beside the waiting position in the detail view; group tables do not show a move action. The opened entry owns a native modal dialog with unique accessible IDs, a target position, and mandatory reason. Canceling leaves the queue unchanged; saving successfully closes the dialog and reloads the server-calculated list. While a write is pending, closing the dialog, navigation, and other write controls are disabled. Validation and server failures keep the dialog open and preserve inputs. Unassigned cards provide a button to open the detail view. The browser manages modal keyboard focus and restores focus on close.

## Verification and scope

`npm.cmd run check` verifies development access restrictions, API validation, frontend rendering, filtering, assignment and failures, and builds. `npm.cmd run db:verify:waitlist` verifies chronological insertion, transfers, unchanged registration timestamps, same-group no-ops, contiguous positions, and rejected statuses against PostgreSQL. All synthetic database records are rolled back. CI runs this database verification as well.

The [status-link delivery workflow](waitlist-status-link-delivery.md) sends mail after first assignment and exposes delivery state and manual recovery in details. It adds a `STATUS_LINK_SENT` timeline entry when SMTP acceptance is recorded. Other email notifications, invitations, authentication, permissions, pagination, and production deployment remain future work.
