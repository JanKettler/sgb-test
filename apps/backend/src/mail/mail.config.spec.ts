import { getMailConfig } from './mail.config.js';

describe('Mail configuration', () => {
  it('is disabled by default and can be explicitly disabled', () => {
    expect(getMailConfig({})).toBeNull();
    expect(getMailConfig({ MAIL_ENABLED: 'false' })).toBeNull();
  });
  it('uses the unauthenticated local inbox defaults', () => {
    expect(getMailConfig({ MAIL_ENABLED: 'true' })).toEqual(
      expect.objectContaining({
        from: 'sgb-portal@example.invalid',
        transport: expect.objectContaining({
          host: '127.0.0.1',
          port: 1025,
          secure: false,
          requireTLS: false,
        }),
      }),
    );
  });
  it('requires STARTTLS for remote SMTP and pairs credentials', () => {
    expect(
      getMailConfig({
        MAIL_ENABLED: 'true',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'example',
        SMTP_PASSWORD: 'secret',
      })?.transport,
    ).toEqual(
      expect.objectContaining({ requireTLS: true, auth: { user: 'example', pass: 'secret' } }),
    );
    expect(
      getMailConfig({
        MAIL_ENABLED: 'true',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
      })?.transport.secure,
    ).toBe(true);
  });
  it.each([
    { MAIL_ENABLED: 'yes' },
    { MAIL_ENABLED: 'true', SMTP_PORT: '0' },
    { MAIL_ENABLED: 'true', SMTP_PORT: '65536' },
    { MAIL_ENABLED: 'true', SMTP_PORT: '1025suffix' },
    { MAIL_ENABLED: 'true', MAIL_FROM: 'invalid' },
    { MAIL_ENABLED: 'true', SMTP_SECURE: 'yes' },
    { MAIL_ENABLED: 'true', SMTP_USER: 'example' },
    { MAIL_ENABLED: 'true', SMTP_PASSWORD: 'secret' },
  ])('rejects invalid configuration (%#)', (configuration) => {
    expect(() => getMailConfig(configuration)).toThrow();
  });
});
