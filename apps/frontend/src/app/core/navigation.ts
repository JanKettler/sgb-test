import { IconName } from '../ui/icon';

export type NavAccess = 'all' | 'manage' | 'admin';

export interface NavItem {
  label: string;
  path: string;
  icon: IconName;
  tone: string;
  access: NavAccess;
  /** Exact match for the home page only. */
  exact?: boolean;
}

export interface NavSection {
  key: string;
  /** Empty for the top block without a title. */
  title: string;
  tone: string;
  items: NavItem[];
}

/** Page that is announced in the menu but not built yet. */
function soon(label: string, key: string, icon: IconName, tone: string): NavItem {
  return { label, path: `/bald/${key}`, icon, tone, access: 'manage' };
}

export const NAVIGATION: readonly NavSection[] = [
  {
    key: 'top',
    title: '',
    tone: 'blue',
    items: [
      { label: 'Startseite', path: '/', icon: 'home', tone: 'blue', access: 'all', exact: true },
      { label: 'Schwarzes Brett', path: '/brett', icon: 'pin', tone: 'amber', access: 'all' },
      { label: 'Aufgaben', path: '/aufgaben', icon: 'tasks', tone: 'green', access: 'manage' },
    ],
  },
  {
    key: 'competition',
    title: 'Wettkampf',
    tone: 'blue',
    items: [
      soon('Wettkämpfe', 'wettkaempfe', 'flag', 'blue'),
      soon('Auswertung', 'auswertung', 'sheet', 'teal'),
    ],
  },
  {
    key: 'training',
    title: 'Training',
    tone: 'green',
    items: [
      {
        label: 'Anmeldung',
        path: '/training/anmeldung',
        icon: 'check',
        tone: 'green',
        access: 'all',
      },
      {
        label: 'Trainingstermine',
        path: '/training/termine',
        icon: 'calendar',
        tone: 'amber',
        access: 'manage',
      },
      {
        label: 'Anwesenheit',
        path: '/training/anwesenheit',
        icon: 'clipboard',
        tone: 'teal',
        access: 'manage',
      },
      {
        label: 'Einstellungen',
        path: '/training/einstellungen',
        icon: 'gear',
        tone: 'violet',
        access: 'admin',
      },
    ],
  },
  {
    key: 'club',
    title: 'Verein',
    tone: 'rose',
    items: [
      { label: 'Personen', path: '/personen', icon: 'users', tone: 'rose', access: 'manage' },
      { label: 'Beiträge', path: '/beitraege', icon: 'coins', tone: 'green', access: 'manage' },
      soon('Jugend', 'jugend', 'swim', 'blue'),
      soon('Vorstand', 'vorstand', 'users', 'violet'),
      soon('Dokumente', 'dokumente', 'sheet', 'amber'),
    ],
  },
  {
    key: 'organisation',
    title: 'Organisation',
    tone: 'violet',
    items: [
      soon('Abrechnung', 'abrechnung', 'coins', 'green'),
      soon('Material', 'material', 'list', 'amber'),
      soon('Veranstaltungen', 'veranstaltungen', 'calendar', 'teal'),
    ],
  },
  {
    key: 'actions',
    title: 'Aktionen',
    tone: 'amber',
    items: [soon('Weihnachtsmarkt', 'weihnachtsmarkt', 'tree', 'green')],
  },
  {
    key: 'waitlist',
    title: 'Warteliste',
    tone: 'amber',
    items: [
      {
        label: 'Anmelden',
        path: '/warteliste/anmelden',
        icon: 'list',
        tone: 'amber',
        access: 'all',
      },
      { label: 'Intern', path: '/intern/warteliste', icon: 'users', tone: 'blue', access: 'admin' },
    ],
  },
];

/** Short descriptions on the pages that are not built yet (taken from the old Intranet). */
export const SOON_PAGES: Record<string, { title: string; text: string }> = {
  wettkaempfe: {
    title: 'Wettkämpfe',
    text: 'Ausschreibungen, Meldungen und Starterlisten der Wettkämpfe.',
  },
  auswertung: {
    title: 'Auswertung',
    text: 'Ergebnisse und Bestzeiten der Schwimmerinnen und Schwimmer.',
  },
  jugend: { title: 'Jugend', text: 'Jugendwarte, Jugendordnung und Jugendveranstaltungen.' },
  vorstand: { title: 'Vorstand', text: 'Vorstandssitzungen, Beschlüsse und Zuständigkeiten.' },
  dokumente: { title: 'Dokumente', text: 'Satzung, Formulare und Vorlagen des Vereins.' },
  abrechnung: { title: 'Abrechnung', text: 'Fahrtkosten, Auslagen und Erstattungen.' },
  material: { title: 'Material', text: 'Ausleihe und Bestand von Vereinsmaterial.' },
  veranstaltungen: { title: 'Veranstaltungen', text: 'Vereinsfeiern, Helferlisten und Termine.' },
  weihnachtsmarkt: {
    title: 'Weihnachtsmarkt',
    text: 'Planung und Helferplan für den Weihnachtsmarkt.',
  },
};
