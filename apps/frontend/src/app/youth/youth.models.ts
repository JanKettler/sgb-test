export const BADGE_STATES = ['laufend', 'bestanden', 'bezahlt'] as const;
export type BadgeState = (typeof BADGE_STATES)[number];

export const BADGE_STATE_LABEL: Record<BadgeState, string> = {
  laufend: 'In Arbeit',
  bestanden: 'Bestanden, Zahlung offen',
  bezahlt: 'Bezahlt',
};

/** A kind of badge with the price the club asks and the requirements to tick off. */
export interface BadgeKind {
  name: string;
  /** Price in euro */
  price: number;
  requirements: string[];
}

/** One badge of one person on its way: in work, passed, paid. */
export interface BadgeRecord {
  id: string;
  /** The name as it is written in the member list. */
  name: string;
  memberNo: string;
  /** The name of the `BadgeKind`. */
  badge: string;
  /** ISO date of the start, or of the exam once it is passed. */
  date: string;
  /** ISO date of the payment; empty while it is open. */
  paidOn: string;
  /** Price in euro; null takes the price of the badge. */
  price: number | null;
  state: BadgeState;
  /** Indexes of the requirements that are ticked. */
  done: number[];
  note: string;
}

export const DEFAULT_CATALOG: readonly BadgeKind[] = [
  {
    name: 'DSA Bronze',
    price: 3,
    requirements: [
      'Kopfsprung',
      '15 min schwimmen: 50 m Rücken + 150 m Brust + x',
      '1 Ring aus 2 m',
      'Paketsprung',
      'Baderegeln',
    ],
  },
  {
    name: 'DSA Silber',
    price: 2,
    requirements: [
      'Kopfsprung',
      '20 min schwimmen: 100 m Rücken + 300 m Brust + x',
      '2× Ring aus 2 m',
      'Sprung aus 3 m / 2 Sprünge 1 m',
      '10 m Tauchen mit Abstoß',
      'Baderegeln',
      'Selbstrettung',
    ],
  },
  {
    name: 'DSA Gold',
    price: 2,
    requirements: [
      'Kopfsprung',
      '30 min schwimmen: 150 m Rücken + 650 m Brust + x',
      'Start + 50 m Brust in 1:15 min',
      'Start + 25 m Kraul',
      '50 m Rücken oder 50 m Brustbeine in Rückenlage',
      '10 m Tauchen ohne Abstoß',
      'Sprung aus 3 m / 2 Sprünge 1 m',
      '3 Ringe aus 2 m (unter 3 min)',
      '50 m Transportschwimmen',
      'Baderegeln',
      'Selbstrettung',
      'Fremdrettung',
    ],
  },
  { name: 'DLA Hai', price: 3, requirements: [] },
  {
    name: 'DLA Silber',
    price: 2,
    requirements: [
      '100 m Brust unter 1:55 min',
      '100 m Kraul unter 1:40 min',
      '100 m Rücken unter 1:50 min',
      '100 m Lagen',
      '400 m Freistil unter 10 min',
      '3-m-Sprung',
      '1-m-Salto',
      '25 m Wasserball dribbeln unter 25 sek',
    ],
  },
  { name: 'DLA Gold', price: 2, requirements: [] },
  {
    name: 'Totenkopf 1 Std.',
    price: 5,
    requirements: ['1 Stunde schwimmen, ohne sich festzuhalten oder etwas zu berühren'],
  },
  {
    name: 'Totenkopf 1,5 Std.',
    price: 5,
    requirements: ['1,5 Stunden schwimmen, ohne sich festzuhalten oder etwas zu berühren'],
  },
  {
    name: 'Totenkopf 2 Std.',
    price: 5,
    requirements: ['2 Stunden schwimmen, ohne sich festzuhalten oder etwas zu berühren'],
  },
];

export function badgeStateOf(value: string): BadgeState {
  return BADGE_STATES.find((state) => state === value) ?? 'laufend';
}

export function emptyRecord(date: string, badge: string): BadgeRecord {
  return {
    id: '',
    name: '',
    memberNo: '',
    badge,
    date,
    paidOn: '',
    price: null,
    state: 'laufend',
    done: [],
    note: '',
  };
}

/** How many of the requirements of the badge are ticked. */
export function ticked(record: BadgeRecord, kind: BadgeKind): number {
  return kind.requirements.filter((_, index) => record.done.includes(index)).length;
}

/** The year of an ISO date as text. */
export function yearOf(iso: string): string {
  return iso.slice(0, 4);
}
