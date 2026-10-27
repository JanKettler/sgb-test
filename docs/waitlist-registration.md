# Public waitlist registration

The Angular page at `/warteliste/anmelden` submits to `POST /api/public/waitlist/registrations`. The backend owns validation and database access. This endpoint accepts registrations only; there is no public listing. The separate [status API](waitlist-status-tokens.md) requires a bearer token issued during future link delivery preparation. Registration itself does not issue or return a token.

## Request

```json
{
  "firstName": "Example",
  "lastName": "Swimmer",
  "birthDate": "2016-02-29",
  "email": "contact@example.com",
  "badges": ["DSA_BRONZE"],
  "swimmingStyles": ["BREASTSTROKE", "BACKSTROKE"],
  "message": "Optional message"
}
```

Names, birth date, email, badges, and swimming styles are required. Names are trimmed, nonblank, and limited to 100 characters each. Email is trimmed, syntactically validated, and limited to 254 characters. Birth date must be a real calendar date in `YYYY-MM-DD` format, from year 1 through the current UTC date. No minimum age is imposed. The date is stored as PostgreSQL `DATE`.

Both selections must be nonempty arrays of distinct supported enum values from [the data model](waitlist-model.md). A higher badge satisfies the Seepferdchen requirement without also selecting `SEAHORSE`. The optional message is trimmed and limited to 2,000 characters; omission or blank text is stored as null. Explicit null is rejected. Extra properties are rejected, including internal notes, group, status, ordering keys, and timestamps.

## Response and persistence

After successful persistence, the API returns HTTP 201:

```json
{ "status": "received" }
```

The response contains no personal data, internal ID, group, or waiting position. The service writes only public fields; database defaults set `UNASSIGNED`, null group and ordering key, and the original registration timestamp. Duplicate emails and registrations are deliberately allowed. When enabled, the shared mail service attempts a German receipt email after persistence. See [email delivery](email-delivery.md). SMTP failure does not undo the registration or change its HTTP 201 response.

Invalid input returns HTTP 400 with NestJS validation messages in English. The frontend shows German field errors or a generic submission failure and preserves input for correction. A success clears the form's personal data. Concurrent submissions from the same form are disabled while a request is pending. Database failures do not produce a successful response or trigger email delivery. The response acknowledges persistence, not email delivery. A retry after a lost response can create a duplicate; deduplication and idempotency are not implemented.

## Verification and remaining scope

`npm.cmd run check` covers frontend form behavior, API validation and storage mapping with a replacement Prisma provider, and both builds. `npm.cmd run db:verify:waitlist` additionally verifies registration persistence through the compiled service and database constraints using transactions that roll back all synthetic records. CI runs both kinds of checks.

This feature is for local development with synthetic data. Before public operation, agree privacy information, retention and deletion rules, abuse protection, and production configuration. Internal access requires backend authentication and authorization in its own implementation step. Group assignment is available through the development-only internal API. Status tokens and the first group-assignment email are implemented in the separate [status-link workflow](waitlist-status-link-delivery.md). Trial invitations remain unimplemented.
