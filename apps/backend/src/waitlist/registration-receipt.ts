import type { MailMessage } from '../mail/mail.service.js';

export function registrationReceipt(registration: {
  firstName: string;
  lastName: string;
  email: string;
}): MailMessage {
  return {
    to: registration.email,
    subject: 'SGB Portal – Eingangsbestätigung zur Warteliste',
    text: [
      'Hallo,',
      '',
      `wir haben die Anmeldung von ${registration.firstName} ${registration.lastName} für die Warteliste der Schwimmgemeinschaft Barnstorf e.V. erhalten.`,
      '',
      'Die Zuordnung zu einer Schwimmgruppe steht noch aus. Es gibt daher noch keinen festgelegten Warteplatz.',
      '',
      'Diese Nachricht bestätigt den Eingang der Anmeldung. Sie ist keine Zusage für einen Schwimmplatz oder ein Probetraining.',
      '',
      'Viele Grüße',
      'Schwimmgemeinschaft Barnstorf e.V.',
    ].join('\n'),
  };
}
