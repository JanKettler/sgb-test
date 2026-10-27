# SGB Portal

Web application for Schwimmgemeinschaft Barnstorf e.V.

## Project status

Technical foundation with Angular and NestJS, plus local PostgreSQL and Prisma. Public registration, internal group tables and details, group assignment, internal notes, and manual queue changes with reason history are implemented. Internal APIs require an explicit development-only opt-in. Registration receipt emails are implemented with local SMTP capture. The public status API, backend-only token issuance, and German status page are implemented; the first group-assignment email includes a private status link with tracked delivery and manual recovery. Google authentication, roles, and permissions remain separate steps. Use synthetic data during development; public operation requires the remaining security and privacy decisions.

## Architecture

- Monorepo with npm Workspaces, without Nx
- `apps/frontend`: Angular 22, Standalone Components, routing, strict TypeScript, SCSS, and Bulma; no SSR
- `apps/backend`: NestJS 12 with a REST API and strict TypeScript
- `docs`: reserved for technical documentation
- `infra`: reserved for future infrastructure configuration
- Code, technical identifiers, APIs, and all documentation are written in English
- The visible user interface is written in German

Only the backend accesses PostgreSQL through Prisma. Google will authenticate users; users, roles, and permissions will be managed in our own database and authorized by the backend.

## Prerequisites

Node.js 24 (at least 24.15), npm 11, and Git. The project was created with Node.js 24.19.0 and npm 11.13.0.

Run all npm commands from the repository root. In Windows PowerShell, use `npm.cmd` if execution of `npm.ps1` is blocked. No globally installed CLIs are required.

## Installation

```powershell
npm.cmd ci
```

The shared `package-lock.json` is tracked in Git. Do not create separate installations or lockfiles inside the applications.

## Local development

Start the applications in two separate terminals:

```powershell
npm.cmd run start:frontend
```

Frontend: http://localhost:4200

```powershell
npm.cmd run start:backend
```

Backend: http://localhost:3000/api (generated example endpoint). Both development servers automatically reload changes.

The frontend requests `GET /api/health` when the start page loads and displays the connection status in German. The Angular development server forwards `/api/**` requests to `http://127.0.0.1:3000` using `apps/frontend/proxy.conf.json`. Start the backend first; if it is unavailable, the page displays an error state. Reload the page after starting the backend. Requests time out after five seconds.

All NestJS routes use the global `/api` prefix. `GET /api/health` returns `{ "status": "ok" }` and checks application liveness only; it does not check database or external service readiness. The response does not include internal configuration or secrets.

To try registration locally, run `npm.cmd run db:up` and `npm.cmd run prisma:migrate:deploy`, then start both applications. Open http://localhost:4200/warteliste/anmelden or follow the start-page link. Successful submissions persist an unassigned entry in PostgreSQL; a receipt email is attempted when mail delivery is enabled, while the waiting position is assigned later. See [local email delivery](#local-email-delivery). The public API only accepts registration submissions and does not expose a list of entries. See [the registration API](docs/waitlist-registration.md) for validation and response details.

For the internal overview and group assignment, add both settings to the ignored root `.env` and restart the backend:

```dotenv
NODE_ENV=development
ENABLE_DEV_WAITLIST_ADMIN=true
```

Open http://localhost:4200/intern/warteliste. Assign a group to calculate a waiting position. Internal API routes return HTTP 404 unless both settings match exactly; `NODE_ENV=production` always blocks them. This temporary opt-in is not authentication and allows access to anyone who can reach the development backend or Angular proxy. Keep local development servers private and use synthetic data. See [internal waitlist administration](docs/waitlist-administration.md) for queue behavior and remaining scope.

The Angular proxy is for development only and is not included in the production build. Production hosting must provide routing for `/api` to the backend, or a separately agreed API URL and CORS configuration for distinct origins. Restart the frontend development server after changing proxy configuration.

The public status page uses `/warteliste/status#<token>` and displays only status, group, and current waiting position. Without a valid link, http://localhost:4200/warteliste/status shows a neutral unavailable message. Registration does not return a token; the first group assignment sends it by email. Existing assigned entries can receive their first link from the detail view. See [the status page](docs/waitlist-status-page.md) for link format, privacy, and verification. Restart the frontend development server after updating `angular.json` to apply its no-referrer header. Status API requests and responses use `no-store`; the development server's static HTML shell uses `no-cache`.

## Root scripts

| Script             | Purpose                                 |
| ------------------ | --------------------------------------- |
| `start:frontend`   | Start the Angular development server    |
| `start:backend`    | Start NestJS in watch mode              |
| `build`            | Build both applications sequentially    |
| `build:frontend`   | Create the Angular production build     |
| `build:backend`    | Compile NestJS                          |
| `test:frontend`    | Run Angular tests once                  |
| `test:backend`     | Run NestJS unit tests once              |
| `test:backend:e2e` | Run backend HTTP integration tests once |

```powershell
npm.cmd run build
```

Build output is written to `apps/frontend/dist/frontend/` and `apps/backend/dist/`. Backend watch and debug modes use `apps/backend/dist-dev/` with a separate incremental cache, so production builds do not remove a running watcher's files. These directories are not tracked in Git. A successful build alone does not establish production readiness. After changing backend TypeScript configuration or start scripts, stop and restart the development server.

## Configuration

The local PostgreSQL container requires `POSTGRES_PASSWORD`; `POSTGRES_PORT` defaults to `5432`. These values belong in the ignored root `.env` file. `.env.example` documents the settings without real secrets. Only the backend and Prisma CLI use `DATABASE_URL`. Frontend code never receives database credentials. Deployment will be implemented in a separate step.

## Foundation verification

Frontend and backend builds have completed successfully. With the full Bulma CSS included, Angular exceeds its default warning budget (approximately 955 kB of uncompressed initial assets against a 500 kB warning budget) but remains below the 1 MB error threshold. The budget has not been increased. Registration and administration pages are loaded as separate lazy chunks.

## Code quality

Prettier is configured centrally at the repository root (`.prettierrc.json`, `.prettierignore`). EditorConfig defines basic file conventions. Angular is checked with ESLint and angular-eslint, including template and accessibility rules. The backend uses the Oxlint configuration supplied by the NestJS generator, with type-aware checks.

| Root script                      | Purpose                                                                     |
| -------------------------------- | --------------------------------------------------------------------------- |
| `format`                         | Format source files and documentation                                       |
| `format:check`                   | Check formatting without modifying files                                    |
| `lint`                           | Check the frontend and backend                                              |
| `lint:frontend` / `lint:backend` | Check one application                                                       |
| `lint:fix`                       | Apply automatic fixes for supported lint findings                           |
| `check`                          | Check formatting, linting, unit and HTTP integration tests, and both builds |

```powershell
npm.cmd run check
```

VS Code extension recommendations are listed in `.vscode/extensions.json`; extensions are not installed automatically. With the Prettier extension installed, files are formatted on save. ESLint uses the frontend as its working directory; Oxlint uses the backend configuration. Open the entire monorepo in VS Code. Commit message hooks are configured as described below. GitHub Actions CI is configured as described below.

## Contribution workflow

Every project change must have a GitHub issue, including features, fixes, maintenance, tooling, and documentation. Before implementation, check [existing issues](https://github.com/frhildebrand/sgb-portal/issues). Create an issue in English with scope and acceptance criteria if none covers the work. Related changes may share an issue.

Reference the issue in the commit message or pull request using `Refs #<number>`. A pull request that fully resolves an issue should use `Closes #<number>` so GitHub closes it when the pull request merges into the default branch. Use `Refs` for partial work. Issue references are a working convention and are not currently enforced by hooks or CI.

For example:

```text
feat(waitlist): add public status page

Refs #2
```

## Commit messages

Use Conventional Commits and write commit messages in English:

```text
<type>(<optional scope>): <description>
```

Examples:

```text
feat(waitlist): add public registration form
fix(frontend): correct mobile navigation spacing
docs: update local development instructions
chore(tooling): configure conventional commits
```

Supported types are `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, and `test`. Scopes are optional and are not restricted to a fixed list. Use `!` after the type or scope, or a `BREAKING CHANGE:` footer, to indicate a breaking change.

Commitlint checks messages using `@commitlint/config-conventional`. Husky runs this check through `.husky/commit-msg`; an invalid message prevents the commit. The hook checks message structure, not whether the text is English.

The root `prepare` script installs the hooks when running `npm install` or `npm ci` in a Git checkout. If dependencies were installed with lifecycle scripts disabled, activate the hooks with:

```powershell
npm.cmd run prepare
```

To check a message manually in PowerShell:

```powershell
'chore(tooling): configure conventional commits' | npm.cmd run commitlint
```

The hook only checks commit messages; it does not run the full quality check. Run `npm.cmd run check` separately. Local hooks can be bypassed; CI also checks commit messages as described below. No automatic versioning or changelog generation is configured.

## Continuous integration

The GitHub Actions workflow in `.github/workflows/ci.yml` runs on branch and tag pushes, pull requests, and manual dispatches. It uses an Ubuntu runner with Node.js 24.19.0 and npm 11.13.0, installs dependencies from the shared lockfile with `npm ci`, and runs `npm run check` to verify formatting, linting, unit and HTTP integration tests, and both builds.

For pull requests, Commitlint checks all commits between the base and head revisions. For pushes, it checks the latest commit message. Earlier repository history is not retroactively checked on pushes. Manually dispatched runs check code quality only.

Husky hooks are disabled in CI; commit messages are checked explicitly. npm downloads are cached using the root lockfile. GitHub Actions are pinned to full commit revisions. The workflow requires read-only repository access and no application secrets. It additionally applies migrations and verifies the waitlist schema against a temporary PostgreSQL service with disposable CI credentials. A temporary Mailpit service also verifies actual SMTP receipt and status-link delivery, including concurrent claims and PostgreSQL-backed token lookup; verification removes only its own synthetic record and messages. Superseded runs for the same ref are canceled, and each job has a 15-minute timeout.

After pushing the workflow, view results in the repository's **Actions** tab. To require a passing CI run before merging, configure a GitHub branch ruleset for `main` and require the **Quality checks** status check after its first run. Branch protection is a repository setting and is not enabled by the workflow itself.

This workflow verifies the application; it does not deploy it. The existing Angular bundle-size warning remains non-fatal.

## Local PostgreSQL

Install Docker Desktop with Docker Compose v2 and use Linux containers. Start Docker Desktop before running database commands. Angular and NestJS continue to run directly on the host; PostgreSQL and the local Mailpit inbox run in Docker.

The local database uses the official `postgres:18.6-bookworm` image. The database and development administrator are both named `sgb_portal`. This administrator is for local development only; production will require separate roles and credentials with appropriate privileges.

If the root `.env` file does not exist, create it from the example:

```powershell
Copy-Item .env.example .env
```

Replace the password placeholder with a random local password. If a `.env` file was generated during setup, it already contains a random password. Never commit this file or use its credentials in production.

Run these commands from the repository root:

```powershell
npm.cmd run db:up
npm.cmd run db:status
npm.cmd run db:check
```

`db:up` downloads the images if needed, starts PostgreSQL and Mailpit in the background, and waits for their health checks. `db:check` runs `SELECT 1` inside the container; it verifies SQL connectivity within the container, not host access or backend integration.

| Script      | Purpose                                           |
| ----------- | ------------------------------------------------- |
| `db:up`     | Start PostgreSQL and Mailpit and wait until ready |
| `db:down`   | Remove both containers; preserve PostgreSQL data  |
| `db:status` | Show container status and health                  |
| `db:logs`   | Follow PostgreSQL logs; exit with Ctrl+C          |
| `db:shell`  | Open an interactive psql session; exit with `\q`  |
| `db:check`  | Run a simple SQL query inside the container       |

Host connection settings:

- Host: `127.0.0.1`
- Port: `5432`, or the value of `POSTGRES_PORT`
- Database: `sgb_portal`
- User: `sgb_portal`
- Password: the value of `POSTGRES_PASSWORD` in `.env`

The published port is bound to the local loopback interface. If port 5432 is already occupied, set another port such as `5433` in `.env` and recreate the container with `db:up`.

The named volume `sgb-portal_postgres_data` persists data across container recreation and `db:down`. PostgreSQL 18 stores its versioned data directory beneath `/var/lib/postgresql`, which is the mounted volume location. A volume is not a backup. Do not use `docker compose down --volumes` unless you intentionally want to delete the local database.

The image initializes the database and administrator credentials only when the data directory is empty. Changing `POSTGRES_PASSWORD` in `.env` does not change the password of an existing database; change it explicitly in PostgreSQL instead. Upgrading the PostgreSQL major version requires a planned data migration, not just changing the image tag.

This configuration is intended for local development. CI starts an isolated PostgreSQL service for migration and schema verification, and `/api/health` remains an application liveness check. The HTTP tests replace Prisma with a test provider; local PostgreSQL connectivity can also be checked separately through `db:check:prisma`.

## Local email delivery

The [status-link delivery workflow](docs/waitlist-status-link-delivery.md) sends a second mail after first group assignment. Tokens are issued during delivery preparation; registration receipts do not contain them. The detail view shows delivery state and permits manual retries with a replacement link. Apply the new migration with `npm.cmd run prisma:migrate:deploy` after updating the project.

Mailpit captures outgoing SMTP messages locally without sending them to recipients. Its inbox is available at http://localhost:8025. Both published ports bind to loopback. The Compose image is pinned to `axllent/mailpit:v1.31.4`; see the [official Docker documentation](https://mailpit.axllent.org/docs/install/docker/).

Add the following settings to the ignored root `.env` if absent, then restart the backend:

```dotenv
MAIL_ENABLED=true
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
MAIL_FROM=sgb-portal@example.invalid
MAILPIT_UI_PORT=8025
```

Start Mailpit with `npm.cmd run mail:up` (or `db:up`), submit a synthetic registration, and open the inbox. The German receipt confirms receipt of the registration; it does not contain a waiting position or status link. Assign a group in the internal overview to receive the second mail with a private status link. Configure `PUBLIC_FRONTEND_URL` with the actual frontend origin (locally `http://localhost:4200` by default); production requires an explicit HTTPS origin.

| Script        | Purpose                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------- |
| `mail:up`     | Start Mailpit and wait until ready                                                           |
| `mail:status` | Show Mailpit status                                                                          |
| `mail:down`   | Stop Mailpit without removing its container                                                  |
| `mail:verify` | Build the backend, verify both SMTP messages with PostgreSQL, and remove synthetic test data |

Mailpit messages are temporary: `db:down` removes the inbox container and its captured messages while preserving the PostgreSQL volume. Use synthetic data locally.

The backend attempts receipt delivery after saving the registration. Status-link delivery separately persists an attempt state and supports manual retries; see [status-link delivery](docs/waitlist-status-link-delivery.md). A receipt SMTP failure leaves the registration saved and returns HTTP 201; it logs a warning without email contents or SMTP credentials. Registration receipts still have no automatic retry or persisted delivery status; this remains to be addressed before production use. Set `MAIL_ENABLED=false` or omit it to disable delivery. See [email delivery](docs/email-delivery.md) for configuration and verification details.

## Prisma and backend database access

The Prisma CLI 7.10.0 is installed as a root development dependency so npm applies the root security overrides consistently across workspaces. The Prisma client runtime, PostgreSQL driver adapter, and `pg` are installed in `apps/backend`. The CLI, generated client runtime, and adapter use matching versions. The schema is in `apps/backend/prisma/schema.prisma`; the CLI configuration is in `apps/backend/prisma.config.ts`.

The first migration creates the waitlist entry and manual-order-change history tables. Fields, statuses, queue rules, and remaining service-layer requirements are documented in [the waitlist data model](docs/waitlist-model.md). Apply committed migrations locally with `npm.cmd run prisma:migrate:deploy`.

Set the connection URL in the ignored root `.env` file:

```dotenv
DATABASE_URL=postgresql://sgb_portal:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:5432/sgb_portal
```

During setup, the URL was populated from the existing local PostgreSQL settings if it was absent. Keep its password and port in sync with the container credentials. URL-encode special characters in the password. Existing process environment variables take precedence over `.env` values. CLI and backend workspace commands load `.env` from the application directory if present, then the root `.env`.

The backend's `DatabaseModule` exports `PrismaService`. Future feature modules can import `DatabaseModule` and inject the service. The service opens the connection during module initialization and disconnects during shutdown. The backend therefore requires valid database configuration and a running PostgreSQL instance at startup. `/api/health` does not perform a database query.

Run from the repository root:

```powershell
npm.cmd run db:up
npm.cmd run prisma:validate
npm.cmd run db:check:prisma
npm.cmd run start:backend
```

`db:check:prisma` builds the backend and executes `SELECT 1` through Prisma and the PostgreSQL driver from the host. It performs no database writes and verifies the configured credentials and connection.

| Script                  | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `prisma:validate`       | Validate the Prisma schema                                 |
| `prisma:generate`       | Generate the backend client                                |
| `db:check:prisma`       | Build and test real PostgreSQL connectivity through Prisma |
| `prisma:migrate:dev`    | Create and apply development migrations                    |
| `prisma:migrate:deploy` | Apply committed migrations in deployment environments      |

The client is generated into `apps/backend/src/generated/prisma` and is excluded from Git, formatting, and linting. Generation runs after backend dependency installation, before backend builds, before the development server starts, and as part of `check`. Generated code is compiled with the backend. The build only compiles `src`, so Prisma CLI configuration is not included in runtime output.

Generation and schema validation work without `DATABASE_URL`; actual database operations require it. CI generates the client and runs HTTP tests with a replacement Prisma provider. It also starts a temporary PostgreSQL service, applies the committed migrations, and runs `db:verify:waitlist` to verify database rules with rollback-only synthetic data. No application secrets are required. Local `check` remains database-independent; run `npm.cmd run db:verify:waitlist` separately after applying migrations.

The root `package.json` temporarily overrides `deepmerge-ts` to `8.0.2` and `mysql2` to `3.24.5` to address security advisories in Prisma CLI dependencies. The application uses the PostgreSQL adapter, not the MySQL driver. DeepmergeTS 8 changes Map merging behavior; our Prisma configuration uses plain configuration objects, and schema validation, client generation, and database access must be rechecked when updating these overrides. Remove the overrides once Prisma includes patched dependencies itself. Keep the shared lockfile committed and use `npm ci` to reproduce the resolved versions.
