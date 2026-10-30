/** Pages of the portal that a message may link to. */
export interface InternalPage {
  label: string;
  path: string;
}

export const INTERNAL_PAGES: readonly InternalPage[] = [
  { label: 'Startseite', path: '/' },
  { label: 'Schwarzes Brett', path: '/brett' },
  { label: 'Training: Anmeldung', path: '/training/anmeldung' },
  { label: 'Training: Trainingstermine', path: '/training/termine' },
  { label: 'Training: Anwesenheit', path: '/training/anwesenheit' },
  { label: 'Personen', path: '/personen' },
  { label: 'Beiträge', path: '/beitraege' },
  { label: 'Warteliste', path: '/warteliste/anmelden' },
];
