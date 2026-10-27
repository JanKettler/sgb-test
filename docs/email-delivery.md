# Email delivery

The backend's `MailModule` exports `MailService`, which sends plain-text messages through Nodemailer and SMTP. Domain-specific content belongs to the corresponding feature: the waitlist builds its German registration receipt separately. There is no generic event system or mail queue.

## Registration receipts

After the database successfully saves a registration, the waitlist service attempts delivery to the submitted email address. The receipt contains the swimmer's name and confirms receipt only. Birth date, qualifications, the public message, and internal notes are not included. The separate [status-link workflow](waitlist-status-link-delivery.md) sends a second mail after initial group assignment. Trial invitations remain future work.

HTTP 201 acknowledges a saved registration. SMTP acceptance does not establish final delivery to a recipient's inbox. If SMTP fails, the registration remains saved and the response still acknowledges it; the backend logs only a fixed warning and the internal entry ID, without SMTP errors, credentials, or message contents. Database failure prevents the mail attempt.

Registration receipts have no automatic retry, persisted delivery status, or timeline event. Status-link messages separately track delivery and support manual recovery. A reliable retry strategy must be agreed before production use. Disabled delivery also leaves registration behavior unchanged.

## Configuration

Configuration loads from the application `.env`, then the root `.env`; existing process environment variables take precedence. Restart the backend after changing environment settings.

| Setting                      | Meaning                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `MAIL_ENABLED`               | Exactly `true` enables SMTP; omitted or `false` disables it |
| `MAIL_FROM`                  | Sender address; default `sgb-portal@example.invalid`        |
| `SMTP_HOST`                  | SMTP host; default `127.0.0.1`                              |
| `SMTP_PORT`                  | Port between 1 and 65535; default `1025`                    |
| `SMTP_SECURE`                | Exactly `true` uses TLS immediately; default `false`        |
| `SMTP_USER`, `SMTP_PASSWORD` | Optional credentials; both must be supplied together        |
| `MAILPIT_UI_PORT`            | Local Docker inbox HTTP port; default `8025`                |

For non-loopback SMTP hosts, non-secure connections require STARTTLS. Certificate verification is not disabled. Connection, greeting, DNS, and socket timeouts bound the SMTP attempt. File and URL access in messages is disabled. No real provider or production credentials are configured at this stage.

## Local inbox and verification

Run `npm.cmd run mail:up` from the repository root, enable the local settings from `.env.example`, and open http://localhost:8025. Mailpit captures messages without forwarding them. SMTP and HTTP ports bind to loopback. Messages belong to the temporary container; removing it with `db:down` clears them. `mail:down` only stops the container. Use synthetic registrations during development.

`npm.cmd run check` covers configuration validation, transport behavior, receipt content, and registration API behavior with mocked SMTP and database providers. It does not require Mailpit. Database verification explicitly disables mail for rollback-only registrations.

`npm.cmd run mail:verify` builds the backend and sends a synthetic receipt through the actual local SMTP transport. It checks the recipient, subject, and text through Mailpit's HTTP API and additionally tests concurrent status-link claims against migrated PostgreSQL. It resolves the mailed token through the status service and removes only its synthetic record and messages. This script requires enabled delivery, a loopback SMTP host, and a running Mailpit inbox. CI runs the same verification against a temporary Mailpit service after the builds.
