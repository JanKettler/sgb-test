import { config } from 'dotenv';

// npm workspace commands run from apps/backend. Environment variables take precedence.
config({ path: ['.env', '../../.env'], quiet: true });

export function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error('DATABASE_URL is required. Configure it in the root .env file.');
  }

  try {
    const url = new URL(value);
    if (
      !['postgresql:', 'postgres:'].includes(url.protocol) ||
      !url.hostname ||
      !url.pathname.slice(1)
    ) {
      throw new Error('Invalid PostgreSQL URL');
    }
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL with a database name.');
  }

  return value;
}
