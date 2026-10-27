import { createHash } from 'node:crypto';
import { generateStatusToken, hashStatusToken } from './status-token.js';

describe('Status tokens', () => {
  it('generates distinct 32-byte canonical base64url secrets and SHA-256 hashes', () => {
    const tokens = Array.from({ length: 100 }, () => generateStatusToken());
    expect(new Set(tokens).size).toBe(100);
    for (const token of tokens) {
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(hashStatusToken(token)).toBe(createHash('sha256').update(token).digest('hex'));
    }
  });

  it.each([
    '',
    'x'.repeat(42),
    'x'.repeat(44),
    'A'.repeat(42) + 'B',
    '='.repeat(43),
    'é'.repeat(43),
  ])('rejects malformed or noncanonical tokens (%#)', (token) =>
    expect(hashStatusToken(token)).toBeNull(),
  );
});
