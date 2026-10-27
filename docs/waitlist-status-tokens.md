# Public waitlist status tokens

This implements [issue #1](https://github.com/frhildebrand/sgb-portal/issues/1). The [public status page](waitlist-status-page.md) is implemented in issue #2; first-group-assignment email delivery is implemented in [issue #3](waitlist-status-link-delivery.md).

## Issuance and storage

`WaitlistStatusService.issueToken(entryId, database?)` is a backend-only operation. It generates 32 bytes using Node.js `crypto.randomBytes`, encodes them as canonical unpadded base64url (43 characters), and stores only their SHA-256 hash. Hashing is appropriate here because the secret already has 256 bits of random entropy; it is not a human-chosen password.

The optional database argument lets issue #3 combine issuance and delivery-state changes in one Prisma transaction. An atomic conditional update only issues a token for a live entry whose hash is null. Concurrent or repeated issuance cannot overwrite an existing token. No HTTP issuance endpoint exists. The caller receives plaintext once, for immediate delivery; it must not log or persist it. The service does not send mail or construct links.

The additive migration introduces nullable `statusTokenHash`, a unique index, and a lowercase hexadecimal hash constraint. Both existing records and new registrations remain tokenless until first delivery preparation. There is no destructive backfill, discarded placeholder secret, registration response token, or change to registration receipts.

The [delivery workflow](waitlist-status-link-delivery.md) combines issuance with a durable attempt state. A hash cannot recover a lost secret after a restart or failed send. Explicit manual retries atomically replace the hash, invalidating any old link; there is no automatic retry or claim of exactly-once SMTP delivery.

## Read-only API

`POST /api/public/waitlist/status` accepts exactly one JSON property:

```json
{ "token": "<43-character base64url bearer token>" }
```

This POST performs no writes. Keeping the token in the request body avoids placing it in API URLs and ordinary access logs. Body/header logging and tracing must never capture bearer secrets. The public status page carries the secret in the page URL fragment, transmits it only in this body, applies a no-referrer policy, and includes no analytics or third-party content. Production requires HTTPS.

A valid token returns HTTP 200 with exactly:

```json
{ "status": "WAITING", "group": "GROUP_4", "position": 3 }
```

No names, birth dates, contact information, IDs, notes, queue keys, hashes, or history are returned. `UNASSIGNED` has null group and position. Only `WAITING` has a numbered position; invited and trial-completed entries retain their group but have null position. One parameterized SQL statement reads the entry and counts waiting entries up to its queue key in a single PostgreSQL snapshot. Gaps do not affect displayed position. Transfers, new assignments, and manual reordering do not change the token.

Malformed, unknown, revoked, accepted, and cancelled tokens return the same HTTP 404 response:

```json
{ "statusCode": 404, "message": "Waitlist status not found" }
```

There is no time-based expiry during the waiting period. Accepted/cancelled status blocks lookup; permanent revocation requires clearing the hash, including when future lifecycle transitions permit reopening. Deletion also removes access. Revocation/rotation endpoints and their authorization are future work.

Successes and handled errors include `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Database failures return a generic HTTP 500 and log only a fixed message. Tokens and underlying exceptions are not logged by this endpoint.

## Rate limiting

The standard [NestJS Throttler](https://docs.nestjs.com/security/rate-limiting) permits 30 lookups per connection IP per 60 seconds, including invalid attempts. Further requests receive HTTP 429 and `Retry-After` before database lookup. Other existing routes are unaffected. Forwarded headers are not trusted by the current Express configuration.

The default store is in memory per backend instance and resets on restart. In local development, clients behind the Angular proxy share its connection IP. Production proxy trust settings and a shared or edge-enforced limiter must be agreed with deployment before running multiple backend instances. No Redis dependency is introduced for this MVP.

## Verification

`npm.cmd run check` covers token format and hashing, conditional issuance, safe projections, invalid input, redacted errors, response headers, and rate limiting. `npm.cmd run db:verify:waitlist` additionally checks actual hash persistence and status lookup, unassigned entries, changing positions, group transfers, closed statuses, and revocation/replacement against PostgreSQL. All synthetic database records roll back. CI runs both checks. Token issuance does not send email.
