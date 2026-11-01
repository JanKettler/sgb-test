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
  icon: IconName;
  items: NavItem[];
}

export const NAVIGATION: readonly NavSection[] = [
  {
    key: 'top',
    title: '',
    tone: 'blue',
    icon: 'home',
    items: [
      { label: 'Startseite', path: '/', icon: 'home', tone: 'blue', access: 'all', exact: true },
      { label: 'Schwarzes Brett', path: '/brett', icon: 'pin', tone: 'amber', access: 'all' },
    ],
  },
  {
    key: 'competition',
    title: 'Wettkampf',
    tone: 'blue',
    icon: 'flag',
    items: [
      {
        label: 'Anmeldung',
        path: '/wettkampf/anmeldung',
        icon: 'check',
        tone: 'green',
        access: 'all',
      },
      {
        label: 'Wettkämpfe',
        path: '/wettkampf/wettkaempfe',
        icon: 'flag',
        tone: 'blue',
        access: 'manage',
      },
      {
        label: 'Auswertung',
        path: '/wettkampf/auswertung',
        icon: 'sheet',
        tone: 'teal',
        access: 'manage',
      },
    ],
  },
  {
    key: 'training',
    title: 'Training',
    tone: 'green',
    icon: 'swim',
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
    icon: 'users',
    items: [
      { label: 'Personen', path: '/personen', icon: 'users', tone: 'rose', access: 'manage' },
      { label: 'Beiträge', path: '/beitraege', icon: 'coins', tone: 'green', access: 'manage' },
      { label: 'Jugend', path: '/jugend', icon: 'swim', tone: 'blue', access: 'manage' },
      { label: 'Vorstand', path: '/vorstand', icon: 'users', tone: 'violet', access: 'manage' },
      { label: 'Dokumente', path: '/dokumente', icon: 'sheet', tone: 'amber', access: 'manage' },
    ],
  },
  {
    key: 'organisation',
    title: 'Organisation',
    tone: 'violet',
    icon: 'tasks',
    items: [
      { label: 'Aufgaben', path: '/aufgaben', icon: 'tasks', tone: 'green', access: 'manage' },
      { label: 'Abrechnung', path: '/abrechnung', icon: 'coins', tone: 'green', access: 'manage' },
      { label: 'Material', path: '/material', icon: 'list', tone: 'amber', access: 'manage' },
    ],
  },
  {
    key: 'actions',
    title: 'Aktionen',
    tone: 'amber',
    icon: 'bolt',
    items: [
      {
        label: 'Veranstaltungen',
        path: '/veranstaltungen',
        icon: 'calendar',
        tone: 'teal',
        access: 'all',
      },
      {
        label: 'Weihnachtsmarkt',
        path: '/weihnachtsmarkt',
        icon: 'tree',
        tone: 'green',
        access: 'manage',
      },
    ],
  },
  {
    key: 'waitlist',
    title: 'Warteliste',
    tone: 'amber',
    icon: 'list',
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
  jugend: { title: 'Jugend', text: 'Jugendwarte, Jugendordnung und Jugendveranstaltungen.' },
  vorstand: { title: 'Vorstand', text: 'Vorstandssitzungen, Beschlüsse und Zuständigkeiten.' },
  dokumente: { title: 'Dokumente', text: 'Satzung, Formulare und Vorlagen des Vereins.' },
  abrechnung: { title: 'Abrechnung', text: 'Fahrtkosten, Auslagen und Erstattungen.' },
  material: { title: 'Material', text: 'Ausleihe und Bestand von Vereinsmaterial.' },
  veranstaltungen: {
    title: 'Veranstaltungen',
    text: 'Vereinsfeiern, Helferlisten und Termine. Mitglieder können sich anmelden, sobald die Veranstaltung dafür freigegeben ist.',
  },
  weihnachtsmarkt: {
    title: 'Weihnachtsmarkt',
    text: 'Planung und Helferplan für den Weihnachtsmarkt.',
  },
};
