import { MailService } from './mail.service.js';

const { sendMail, close, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn();
  const close = vi.fn();
  return { sendMail, close, createTransport: vi.fn(() => ({ sendMail, close })) };
});
vi.mock('nodemailer', () => ({ default: { createTransport } }));

describe('MailService', () => {
  beforeEach(() => {
    vi.stubEnv('MAIL_ENABLED', 'true');
    vi.stubEnv('SMTP_HOST', '127.0.0.1');
    vi.stubEnv('SMTP_PORT', '1025');
    vi.stubEnv('SMTP_USER', '');
    vi.stubEnv('SMTP_PASSWORD', '');
    vi.clearAllMocks();
    sendMail.mockResolvedValue({ accepted: ['example@example.invalid'], rejected: [] });
  });
  afterEach(() => vi.unstubAllEnvs());
  const message = { to: 'example@example.invalid', subject: 'Example', text: 'Synthetic message' };
  it('does not connect or send when disabled', async () => {
    vi.stubEnv('MAIL_ENABLED', 'false');
    expect(await new MailService().send(message)).toBe('disabled');
    expect(createTransport).not.toHaveBeenCalled();
  });
  it('uses an explicit single recipient and closes on shutdown', async () => {
    const service = new MailService();
    expect(await service.send(message)).toBe('sent');
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: { address: message.to, name: '' },
        subject: message.subject,
        text: message.text,
      }),
    );
    service.onModuleDestroy();
    expect(close).toHaveBeenCalledOnce();
  });
  it('rejects SMTP recipient refusal', async () => {
    sendMail.mockResolvedValue({ accepted: [], rejected: [message.to] });
    await expect(new MailService().send(message)).rejects.toThrow('did not accept');
  });
});
