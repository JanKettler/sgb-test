import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDatabaseUrl } from './database.config.js';

describe('getDatabaseUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('requires a connection URL', () => {
    vi.stubEnv('DATABASE_URL', undefined);
    expect(() => getDatabaseUrl()).toThrow('DATABASE_URL is required');
  });

  it('rejects unsupported protocols without exposing credentials', () => {
    vi.stubEnv('DATABASE_URL', 'https://user:secret@example.com/database');
    expect(() => getDatabaseUrl()).toThrow(
      'DATABASE_URL must be a valid PostgreSQL connection URL',
    );
  });

  it('requires a database name', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost');
    expect(() => getDatabaseUrl()).toThrow(
      'DATABASE_URL must be a valid PostgreSQL connection URL',
    );
  });

  it('accepts a PostgreSQL connection URL', () => {
    const url = 'postgresql://user:local-password@127.0.0.1:5432/sgb_portal';
    vi.stubEnv('DATABASE_URL', url);
    expect(getDatabaseUrl()).toBe(url);
  });
});
