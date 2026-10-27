import { config } from 'dotenv';
import { isEmail } from 'class-validator';

config({ path: ['.env', '../../.env'], quiet: true });

export function getMailConfig(environment: NodeJS.ProcessEnv = process.env) {
  if (!environment.MAIL_ENABLED || environment.MAIL_ENABLED === 'false') return null;
  if (environment.MAIL_ENABLED !== 'true') throw new Error('MAIL_ENABLED must be true or false');
  const host = environment.SMTP_HOST?.trim() || '127.0.0.1';
  const rawPort = environment.SMTP_PORT ?? '1025';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('SMTP_PORT must be a valid port number');
  if (environment.SMTP_SECURE && !['true', 'false'].includes(environment.SMTP_SECURE))
    throw new Error('SMTP_SECURE must be true or false');
  const from = environment.MAIL_FROM?.trim() || 'sgb-portal@example.invalid';
  if (!isEmail(from)) throw new Error('MAIL_FROM must be a valid email address');
  if (Boolean(environment.SMTP_USER) !== Boolean(environment.SMTP_PASSWORD))
    throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together');
  const secure = environment.SMTP_SECURE === 'true';
  return {
    from,
    transport: {
      host,
      port,
      secure,
      requireTLS: !secure && !['127.0.0.1', 'localhost', '::1'].includes(host),
      ...(environment.SMTP_USER && environment.SMTP_PASSWORD
        ? { auth: { user: environment.SMTP_USER, pass: environment.SMTP_PASSWORD } }
        : {}),
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      dnsTimeout: 5000,
      disableFileAccess: true,
      disableUrlAccess: true,
    },
  };
}
