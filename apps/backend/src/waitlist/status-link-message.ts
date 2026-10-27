import type { MailMessage } from '../mail/mail.service.js';

export function getPublicFrontendUrl(environment: NodeJS.ProcessEnv = process.env): string {
  if (environment.NODE_ENV === 'production' && !environment.PUBLIC_FRONTEND_URL)
    throw new Error('PUBLIC_FRONTEND_URL must be configured in production');
  let url: URL;
  try {
    url = new URL(environment.PUBLIC_FRONTEND_URL || 'http://localhost:4200');
  } catch {
    throw new Error('PUBLIC_FRONTEND_URL must be a valid frontend origin');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && local && environment.NODE_ENV !== 'production'))
  )
    throw new Error(
      'PUBLIC_FRONTEND_URL must be an HTTPS origin (local HTTP is allowed in development)',
    );
  return url.origin;
}

export function statusLinkMessage(email: string, origin: string, token: string): MailMessage {
  const link = new URL('/warteliste/status', origin);
  link.hash = token;
  return {
    to: email,
    subject: 'SGB Portal – Dein Statuslink zur Warteliste',
    text: `Hallo,\n\ndeine Anmeldung wurde einer Schwimmgruppe zugeordnet. Über diesen persönlichen Link kannst du den aktuellen Status, die Gruppe und den Warteplatz ansehen:\n\n${link.href}\n\nDer Warteplatz kann sich ändern und ist keine Zusage für einen Platz in der Schwimmgruppe.\nBitte gib diesen Link nicht weiter. Falls du bereits einen Statuslink erhalten hast, ersetzt dieser neue Link den bisherigen.\n\nViele Grüße\nSGB Portal\n`,
  };
}
