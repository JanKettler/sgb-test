# Public waitlist status page

This implements [issue #2](https://github.com/frhildebrand/sgb-portal/issues/2), using the [token-based status API](waitlist-status-tokens.md) from issue #1. Status-link email delivery is implemented in [issue #3](waitlist-status-link-delivery.md).

## Link format and behavior

The standalone, lazy Angular route is `/warteliste/status#<token>`. The fragment contains only the canonical 43-character base64url bearer token, without a `token=` prefix. It is not part of the HTTP page request. Do not use a query parameter or path segment for the secret.

The page reads `ActivatedRoute.fragment` and submits the secret only as `{ "token": "..." }` in the body of `POST /api/public/waitlist/status`. It does not require login, issue tokens, store them in browser storage, or expose them in the DOM. The fragment remains in the address bar so reloading the original link works. Treat the complete link as a secret, including browser history, screenshots, and manual sharing.

All visible text is German. The page shows only status, assigned group, and the current server-calculated waiting position. Unassigned entries explain that group assignment and the first position are still pending. Invited/trial-completed entries show their status and group without a position. The page does not promise a place in a group, collect personal information, or offer registration changes.

Opening or reloading a link fetches current data. There is no refresh button, supplementary informational text for waiting entries, polling, or automatic retry. Requests time out after ten seconds. Changing fragments or leaving the page cancels pending requests so old responses cannot replace a newer link's result. Each lookup clears the previous result before loading to avoid presenting stale data as current.

Missing, malformed, unknown, revoked, and closed links receive the same neutral unavailable message. Network/server failures show a neutral error without displaying API error details; reloading the page retries the lookup. HTTP 429 asks the user to wait one minute before trying again. Unexpected response shapes are rejected; extra fields are never displayed. Live status messages, error alerts and a single-column layout on small screens support keyboard and mobile use.

## Privacy and hosting

The HTML document sets `<meta name="referrer" content="no-referrer">` before loading resources. Status requests explicitly use `referrerPolicy: 'no-referrer'`, `cache: 'no-store'`, and `credentials: 'omit'`. The API already returns `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. No analytics, third-party resources, or token logging are added.

The Angular development server sends `Referrer-Policy: no-referrer`. Restart it after updating `angular.json`. Its Vite HTML middleware uses `Cache-Control: no-cache` for the static application shell, even when custom cache headers are configured; that shell contains neither the token nor the status response. Sensitive API requests and responses use `no-store`. Production hosting remains a separate step: configure SPA fallback for `/warteliste/status`, use HTTPS, and send `Cache-Control: no-store` and `Referrer-Policy: no-referrer` on the status-page HTML response as well as the API. Static Angular code cannot set a server response's cache headers; the HTML meta tag only controls referrers. Keep tokens out of analytics, request-body logging, and tracing when those systems are introduced.

## Local verification

Start the frontend and backend as described in the README. Opening http://localhost:4200/warteliste/status without a fragment shows the neutral unavailable state. Actual status links require an issued token; registration does not return one, and there is no public token-issuance endpoint. First group assignment makes links available in Mailpit after delivery preparation; existing assigned entries have a manual send action in their detail view. Do not create temporary public issuance endpoints or print existing secrets for testing.

Frontend tests use synthetic fragments and HTTP mocks. They cover loading, unassigned and assigned states, all four groups, invited/trial-completed states, changed positions on reopening the page, unavailable links, errors, rate limiting, timeout/cancellation, response validation, privacy request options, and lazy routing without authentication. The existing PostgreSQL verification covers actual token resolution and queue changes. Run the frontend tests, lint, formatting check, and production build from the repository root.
