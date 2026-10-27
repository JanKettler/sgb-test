import { PayMethod } from '../people/people.models';

export interface FeeType {
  id: string;
  name: string;
  /** Short rule shown below the name, e.g. "Jahrgang 2007 und älter". */
  rule: string;
  /** Assigned automatically from age and family; otherwise it is given out by hand. */
  auto: boolean;
  /** Amount in euro per year */
  amount: number;
  /** Longer explanation on the edit card */
  note: string;
}

/** One yearly fee that has to be paid by one payer. */
export interface Payment {
  id: string;
  /** Members this payment covers; empty for passive supporters without a member record. */
  memberIds: string[];
  /** Names of the covered people, as shown in the list. */
  label: string;
  /** Id of the parent or member who pays. */
  payerId: string;
  payerName: string;
  feeTypeId: string;
  amount: number;
  method: PayMethod;
  /** ISO date the payment fell due */
  dueDate: string;
  paid: boolean;
  /** ISO date the payment was booked */
  paidOn: string;
  /** Reminder level already sent: 0 = none */
  dunning: number;
  purpose: string;
}

export interface FeeSettings {
  feeLevel1: number;
  feeFromLevel2: number;
  daysLevel1: number;
  daysFromLevel2: number;
  copyTo: string;
  remindDebit: boolean;
  remindTransfer: boolean;
  purposeTemplate: string;
  accountHolder: string;
  bank: string;
  iban: string;
  bic: string;
  creditorId: string;
}

export const PLACEHOLDERS: readonly string[] = [
  '[VORNAME]',
  '[NACHNAME]',
  '[MITGLIEDNR]',
  '[JAHR]',
  '[BEITRAGNAME]',
  '[MONAT]',
  '[ZAHLINTERVALL]',
];

export function euro(value: number): string {
  return `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function parseEuro(text: string): number {
  const value = Number(
    text
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, ''),
  );
  return Number.isFinite(value) ? value : 0;
}
