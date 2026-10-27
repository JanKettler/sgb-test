import { createHash, randomBytes } from 'node:crypto';

export function generateStatusToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashStatusToken(token: string): string | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  // Reject noncanonical encodings rather than accepting aliases of the same secret.
  if (Buffer.from(token, 'base64url').toString('base64url') !== token) return null;
  return createHash('sha256').update(token, 'ascii').digest('hex');
}
