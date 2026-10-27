# Status-link delivery

This implements [issue #3](https://github.com/frhildebrand/sgb-portal/issues/3), using the existing mail service, [status tokens](waitlist-status-tokens.md), and [public status page](waitlist-status-page.md). It is a waitlist-specific workflow, not a generic notification queue.

## Initial assignment and delivery

The first group-assignment transaction sets `statusLinkDelivery` from `NONE` to `PENDING`. Assignment and history commit before an automatic delivery attempt starts. Same-group no-ops and subsequent transfers never trigger another automatic attempt. Existing assigned entries retain `NONE`; the migration does not send mail or claim earlier delivery.

The delivery service takes a per-entry PostgreSQL row lock in a separate short transaction, checks eligibility, assigns a UUID attempt ID and timestamp, sets `SENDING`, and issues a token. Only its hash is persisted. The claim transaction commits before SMTP. Concurrent callers observe the claim and cannot start another current attempt. The shared queue advisory lock is not held during SMTP.

After SMTP, completion updates only the matching current attempt ID. `SENT` means the SMTP server accepted the mail, not that it reached the recipient's inbox. The acceptance timestamp appears in details and the lifecycle timeline as `STATUS_LINK_SENT`. SMTP exceptions or disabled mail become `FAILED` without exposing underlying errors. Group assignment remains saved. A completion/database failure can leave `SENDING`; no automatic retry is performed.

## States and manual recovery

| Stored state | Meaning                                                  | Manual action                              |
| ------------ | -------------------------------------------------------- | ------------------------------------------ |
| `NONE`       | No delivery prepared; includes existing assigned entries | Send first link if assigned and not closed |
| `PENDING`    | Assignment saved; delivery not claimed yet               | Send pending link                          |
| `SENDING`    | Claimed attempt with SMTP/completion in progress         | Wait; refresh delivery status              |
| `SENT`       | SMTP acceptance recorded                                 | No further send action                     |
| `FAILED`     | Delivery not confirmed, including disabled SMTP          | Retry explicitly                           |

After two minutes, details project a still-`SENDING` attempt as `UNKNOWN` and allow manual recovery. The stored state stays `SENDING` until recovery; there is no background sweeper. Unassigned, accepted, and cancelled entries cannot send a link.

Every manual first send or retry issues a fresh token and invalidates any previous hash in the same claim transaction. A hash cannot recover the original secret after a restart. SMTP may have accepted a message even when the application saw an error or crashed; manual retry can therefore produce an additional mail and invalidate the earlier link. The UI warns about this replacement. Late completion from an older attempt cannot overwrite a newer attempt's state. This deliberately does not claim exactly-once SMTP delivery or guaranteed cancellation of a stalled old transport.

`POST /api/internal/waitlist/:id/status-link` accepts no action data and returns HTTP 200 with `{ "status": "sent" }` or `{ "status": "failed" }`. Unknown IDs return 404, invalid UUIDs 400, and ineligible or active attempts 409. It uses the same development-only access guard as internal administration; future production authorization must require an explicit mail-send permission. Responses never include the token or email contents. Public issuance/retry endpoints do not exist.

The detail view displays state and confirmed acceptance time, offers manual sending/retry when eligible, and provides a status refresh for uncertain attempts. Refreshing delivery state preserves unsaved notes. Navigation and writes are blocked during a send. After an uncertain HTTP result, the UI refreshes state before allowing another attempt.

## Link configuration and message

`PUBLIC_FRONTEND_URL` is the frontend origin, such as `http://localhost:4200` locally. Production requires an explicitly configured HTTPS origin. Credentials, query strings, fragments, and path prefixes are rejected. Link construction does not use request Host headers.

The German plain-text message links to `/warteliste/status#<token>`. It contains no internal notes, names, birth dates, or fixed waiting position. The page resolves the current group/position even after transfers. The email explains that the position may change, does not promise a group place, and advises keeping the link private. Tokens, recipients, SMTP errors, and message contents are not logged by the delivery service.

## Verification

`npm.cmd run check` covers claim/eligibility logic, concurrent requests, failure/retry, token replacement, configuration validation, protected HTTP access, internal UI behavior, and both builds. Database verification uses rollback-only synthetic data and mocked SMTP to check initial assignment, same-group no-op, transfers, retained assignment on SMTP failure, replacement links, existing entries, and uncertain recovery.

`npm.cmd run mail:verify` now requires migrated PostgreSQL and Mailpit. It verifies both the registration receipt and a status-link message. Two concurrent automatic claims on a committed synthetic assigned entry must produce one status-link mail; the token read from that mail resolves through the actual PostgreSQL-backed status service. The synthetic record never enters a waiting queue. Only that record and messages for the unique synthetic recipient are removed. CI runs this after migrations and builds.
