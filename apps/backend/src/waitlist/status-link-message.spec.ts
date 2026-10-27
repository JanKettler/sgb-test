import { getPublicFrontendUrl, statusLinkMessage } from './status-link-message.js';

describe('Status-link message configuration', () => {
  it('allows local development and explicit production HTTPS origins', () => {
    expect(getPublicFrontendUrl({})).toBe('http://localhost:4200');
    expect(
      getPublicFrontendUrl({
        NODE_ENV: 'production',
        PUBLIC_FRONTEND_URL: 'https://portal.example.com/',
      }),
    ).toBe('https://portal.example.com');
  });
  it.each([
    { NODE_ENV: 'production' },
    { PUBLIC_FRONTEND_URL: 'invalid' },
    { PUBLIC_FRONTEND_URL: 'http://example.com' },
    { NODE_ENV: 'production', PUBLIC_FRONTEND_URL: 'http://localhost:4200' },
    { PUBLIC_FRONTEND_URL: 'https://user:secret@example.com' },
    { PUBLIC_FRONTEND_URL: 'https://example.com/path' },
    { PUBLIC_FRONTEND_URL: 'https://example.com?token=secret' },
    { PUBLIC_FRONTEND_URL: 'https://example.com#secret' },
  ])('rejects unsafe origins without reflecting configuration (%#)', (environment) => {
    expect(() => getPublicFrontendUrl(environment)).toThrow(/PUBLIC_FRONTEND_URL must/);
    try {
      getPublicFrontendUrl(environment);
    } catch (error) {
      expect(String(error)).not.toContain('secret');
    }
  });
  it('includes only a fragment-based status link and no personal or internal fields', () => {
    const message = statusLinkMessage(
      'recipient@example.invalid',
      'https://portal.example.com',
      'A'.repeat(43),
    );
    expect(message.text).toContain(
      `https://portal.example.com/warteliste/status#${'A'.repeat(43)}`,
    );
    expect(message.text).toContain('ersetzt dieser neue Link den bisherigen');
    expect(message.text).not.toContain('recipient@example.invalid');
  });
});
