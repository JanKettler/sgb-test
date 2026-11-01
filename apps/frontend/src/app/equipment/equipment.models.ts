export type Condition = 'gut' | 'gebraucht' | 'defekt';

export const CONDITIONS: readonly Condition[] = ['gut', 'gebraucht', 'defekt'];

/** One lent item or one lent piece of an item. */
export interface Loan {
  id: string;
  /** Name of the member, as it is written in the member list. */
  who: string;
  /** How many were lent; always 1 for numbered pieces. */
  count: number;
  /** The numbered piece, e.g. "Nr. 2"; empty for items without numbered pieces. */
  piece: string;
  /** ISO date of handing out. */
  since: string;
  /** ISO date by which it should be back; empty when nothing was agreed. */
  until: string;
  note: string;
}

/** A loan that came back; the last few are kept as a short history. */
export interface ReturnedLoan {
  who: string;
  count: number;
  piece: string;
  since: string;
  back: string;
}

export interface EquipmentItem {
  id: string;
  title: string;
  category: string;
  place: string;
  /** Total stock; for items with numbered pieces it follows the pieces. */
  stock: number;
  /** Buy more when less than this is available; null means no minimum. */
  minimum: number | null;
  unit: string;
  condition: Condition;
  /** Put on the shopping list by hand. */
  toBuy: boolean;
  /** Numbered pieces ("Nr. 1", "Nr. 2"); each is lent on its own. Empty for counted items. */
  pieces: string[];
  note: string;
  loans: Loan[];
  history: ReturnedLoan[];
}

/** The stock of one kind of badge; the youth page takes one piece off when a badge is paid. */
export interface BadgeStock {
  name: string;
  /** Pieces on hand; null when the stock is not kept. */
  stock: number | null;
  /** Order more when the stock is at or below this; null for no hint. */
  minimum: number | null;
}

export const BADGE_NAMES: readonly string[] = [
  'DSA Bronze',
  'DSA Silber',
  'DSA Gold',
  'DLA Hai',
  'DLA Silber',
  'DLA Gold',
  'Totenkopf 1 Std.',
  'Totenkopf 1,5 Std.',
  'Totenkopf 2 Std.',
];

/** How many of the item can be lent right now. */
export function availableOf(item: EquipmentItem): number {
  if (item.pieces.length > 0) return item.pieces.length - item.loans.length;
  return item.stock - item.loans.reduce((sum, loan) => sum + loan.count, 0);
}

/** Below the minimum; items with numbered pieces have no minimum. */
export function isLow(item: EquipmentItem): boolean {
  return item.minimum !== null && item.pieces.length === 0 && availableOf(item) < item.minimum;
}

/** How many have to be bought to reach the minimum again. */
export function missingOf(item: EquipmentItem): number {
  const minimum = item.minimum;
  if (minimum === null || !isLow(item)) return 0;
  return minimum - availableOf(item);
}

export function needsBuying(item: EquipmentItem): boolean {
  return item.toBuy || isLow(item);
}

export function isOverdue(loan: Loan, today: string): boolean {
  return loan.until !== '' && loan.until < today;
}

/** "Stoppuhr Nr. 2" for a numbered piece, "Medaillen (12×)" for a counted item. */
export function loanText(item: EquipmentItem, loan: Loan): string {
  if (loan.piece) return `${item.title} ${loan.piece}`;
  return item.pieces.length > 0 ? item.title : `${item.title} (${loan.count}×)`;
}

export function conditionOf(value: string): Condition {
  return CONDITIONS.find((condition) => condition === value) ?? 'gut';
}
