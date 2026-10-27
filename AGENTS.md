# Project conventions

## Language

- Write all documentation in English, including README files and technical documentation.
- Use English for code, technical identifiers, and APIs.
- Keep visible user interface text in German.
- Communicate with the user in German unless requested otherwise.

## Working approach

- Work in small, understandable steps and stay within the scope of the current request.
- Explain important architecture decisions and their implications; this project also serves to learn Angular and backend development.
- If a new decision affects the future architecture, explain it to the user before choosing an approach.
- Do not rewrite large parts of the project or introduce unrelated changes without prior agreement.
- Keep implementations simple, follow established Angular and NestJS conventions, and avoid overengineering.
- Consider production security, privacy, authorization, backups, and maintainability from the start without implementing future features prematurely.

## Architecture

- Use a monorepo with `apps/frontend` and `apps/backend`, managed through npm Workspaces without Nx.
- Keep the Angular frontend and NestJS backend clearly separated and communicate through a REST API.
- Use Angular 22 with Standalone Components, routing, strict TypeScript, SCSS, and Bulma; do not introduce SSR without agreement.
- Use NestJS with strict TypeScript. PostgreSQL and Prisma are the agreed database and ORM for a later implementation step.
- Only the backend may access the database. Never expose database credentials or other secrets to the frontend.
- Organize features by domain as they are implemented. Do not create speculative modules or abstractions for future functionality.
- Google will provide authentication only. Manage users, roles, and permissions in the application's own database and enforce authorization in the NestJS backend.
- Roles should bundle explicit permissions such as `waitlist.read` and `waitlist.invite`; keep the permission model extensible across modules.
- Public pages and protected internal pages belong to the same application. Enforce access restrictions in the backend, not only through frontend navigation or guards.
- Implement email delivery as a shared backend service when that feature is requested.
- Do not build a generic event system in advance. Abstract shared concepts only when actual requirements reveal common behavior.

## Scope and delivery

- The first domain MVP is the waitlist. WebClub is not being replaced at this stage.
- Implement database integration, authentication, permissions, email delivery, and domain features only when included in an agreed implementation step.
- Deployment and hosting are separate steps; preserve the ability to build and deploy frontend and backend independently.
- Keep the README focused on setup and usage, agent instructions in this file, and detailed technical documentation in `docs/`.
- Track every project change in a GitHub issue, including features, fixes, maintenance, tooling, and documentation. Related changes may share one issue.
- Before implementation, check existing issues and use one that covers the work. If none does, create an issue in English describing the scope and acceptance criteria.
- Link the issue in the commit message or pull request with `Refs #<number>`. Use `Closes #<number>` in a pull request only when it fully resolves the issue; otherwise use `Refs #<number>`.

## Tooling and verification

- Run npm commands from the repository root and maintain one shared `package-lock.json`.
- Use `npm.cmd` and `npx.cmd` in Windows PowerShell if execution of their PowerShell wrappers is blocked; global CLI installations are not required.
- Use the shared Prettier and EditorConfig settings. Use ESLint with angular-eslint for the frontend and Oxlint for the backend.
- Run checks appropriate to the change. Use `npm run check` for a complete formatting, linting, test, and build verification when needed.
- Keep local environment files, secrets, dependencies, and generated build output out of Git. Example environment files must not contain real secrets.
- Report what changed, how it was verified, and any remaining warnings or limitations.
- Write commit messages in English using Conventional Commits. Use the configured Commitlint rules; scopes are optional. Keep commits focused on a coherent change.
