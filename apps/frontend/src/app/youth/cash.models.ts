export const DEFAULT_CATEGORIES: readonly string[] = [
  'Material',
  'Veranstaltung',
  'Ausflug / Freizeit',
  'Pokale / Preise',
  'Verpflegung',
  'Sonstiges',
];

export type EntryKind = 'in' | 'out';
export type EntryStatus = 'open' | 'confirmed';

/** One booking of the youth cash: income or expense. */
export interface CashEntry {
  id: string;
  kind: EntryKind;
  amount: number;
  /** ISO date */
  date: string;
  category: string;
  text: string;
  receipt: string;
  status: EntryStatus;
  /** Who booked it. */
  from: string;
  /** Who confirmed it; empty while the booking is open. */
  confirmedBy: string;
  /** Where the booking comes from, e.g. "abz:r-3" for a paid badge or an expense id. */
  ref: string;
}

export const EXPENSE_STATES = ['requested', 'approved', 'rejected', 'refunded'] as const;
export type ExpenseState = (typeof EXPENSE_STATES)[number];

export const EXPENSE_LABEL: Record<ExpenseState, string> = {
  requested: 'beantragt',
  approved: 'genehmigt',
  rejected: 'abgelehnt',
  refunded: 'erstattet',
};

/** Money that somebody paid in advance and wants back. */
export interface Expense {
  id: string;
  amount: number;
  /** ISO date */
  date: string;
  text: string;
  receipt: string;
  from: string;
  state: ExpenseState;
  handledBy: string;
}

/** A cash count: how much was really in the cash box compared to the book. */
export interface CashCount {
  id: string;
  /** ISO date */
  date: string;
  counted: number;
  expected: number;
  difference: number;
  /** Number of notes and coins by value, e.g. { "5": 3 }. */
  pieces: Record<string, number>;
  note: string;
  by: string;
}

/** A month that is closed: its bookings cannot be changed any more. */
export interface MonthClosing {
  /** "YYYY-MM" */
  month: string;
  balance: number;
  by: string;
  /** ISO date */
  at: string;
}

export interface CashConfig {
  opening: number;
  place: string;
  holder: string;
  /** ISO date */
  since: string;
  categories: string[];
}

export const DENOMINATIONS: readonly number[] = [
  100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01,
];

export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Income counts plus, expenses minus. */
export function signedAmount(entry: Pick<CashEntry, 'kind' | 'amount'>): number {
  return entry.kind === 'out' ? -entry.amount : entry.amount;
}

export function emptyEntry(kind: EntryKind, date: string, category: string): CashEntry {
  return {
    id: '',
    kind,
    amount: 0,
    date,
    category,
    text: '',
    receipt: '',
    status: 'open',
    from: '',
    confirmedBy: '',
    ref: '',
  };
}

/** "5 €" for notes, "0,50 €" for coins. */
export function denominationLabel(value: number): string {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',');
  return `${text} €`;
}

export function piecesText(pieces: Record<string, number>): string {
  return DENOMINATIONS.filter((value) => (pieces[String(value)] ?? 0) > 0)
    .map((value) => `${pieces[String(value)]}× ${denominationLabel(value)}`)
    .join(' · ');
}
