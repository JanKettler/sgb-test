import { roundCents } from '../core/money';

export const STATEMENT_STATES = ['draft', 'submitted', 'paid'] as const;
export type StatementState = (typeof STATEMENT_STATES)[number];

export const STATEMENT_LABEL: Record<StatementState, string> = {
  draft: 'Entwurf',
  submitted: 'eingereicht',
  paid: 'bezahlt',
};

export const DRIVE_STATES = ['open', 'submitted', 'settled'] as const;
export type DriveState = (typeof DRIVE_STATES)[number];

export const DRIVE_LABEL: Record<DriveState, string> = {
  open: 'offen',
  submitted: 'eingereicht',
  settled: 'abgerechnet',
};

/** The three billing periods of a year; the drives can also be looked at for the whole year. */
export const PERIODS = ['Jan - Mai', 'Mai - Sep', 'Sep - Dez'] as const;
export const DRIVE_PERIODS = [...PERIODS, 'Ganzes Jahr'] as const;
/** Index of "Ganzes Jahr" in `DRIVE_PERIODS`. */
export const WHOLE_YEAR = PERIODS.length;

/** One row of a statement: a training unit that was held. */
export interface StatementLine {
  id: string;
  date: string;
  /** Start, HH:mm */
  time: string;
  minutes: number;
  group: string;
  place: string;
}

/** A trainer's statement of the units held in one period, with kilometres and other costs. */
export interface Statement {
  id: string;
  owner: string;
  /** The period, e.g. "Mai - Sep 2026". */
  title: string;
  state: StatementState;
  name: string;
  /** Number of the trainer at the sports association. */
  edv: string;
  license: string;
  /** Euro per hour. */
  rate: number;
  km: number;
  /** Euro per kilometre. */
  kmRate: number;
  carText: string;
  extra: number;
  extraText: string;
  accountHolder: string;
  iban: string;
  bic: string;
  lines: StatementLine[];
  paidOn: string;
  paidBy: string;
  /** Counts up with every change, so that the newest statement comes first. */
  changed: number;
}

export interface StatementSums {
  /** Hours as a number with up to two decimals. */
  hours: number;
  pay: number;
  car: number;
  extra: number;
  total: number;
}

export interface LicenseRate {
  name: string;
  rate: number;
}

export interface Rates {
  /** Euro per hour when the license has no rate of its own. */
  hourly: number;
  /** Euro per kilometre. */
  km: number;
  /** Flat fee per drive to the competition training. */
  driveFee: number;
  drivers: string[];
  licenses: LicenseRate[];
}

/** What a trainer enters once, so that new statements are filled in. */
export interface Profile {
  edv: string;
  license: string;
  accountHolder: string;
  iban: string;
  bic: string;
}

/** A drive to the competition training, paid with a flat fee. */
export interface Drive {
  id: string;
  owner: string;
  date: string;
  note: string;
  amount: number;
  state: DriveState;
  settledOn: string;
}

export const EMPTY_PROFILE: Profile = {
  edv: '',
  license: '',
  accountHolder: '',
  iban: '',
  bic: '',
};

/** Index of the period a date belongs to: January to April, May to August, September to December. */
export function periodIndex(iso: string): number {
  const month = Number(iso.slice(5, 7));
  return month <= 4 ? 0 : month <= 8 ? 1 : 2;
}

export function periodTitle(iso: string): string {
  return `${PERIODS[periodIndex(iso)]} ${iso.slice(0, 4)}`;
}

/** Whether the date lies in the period of the year; `WHOLE_YEAR` takes every date of the year. */
export function inPeriod(iso: string, year: number, period: number): boolean {
  if (Number(iso.slice(0, 4)) !== year) return false;
  return period >= WHOLE_YEAR || periodIndex(iso) === period;
}

/** The year and period that a title like "Mai - Sep 2026" names; null when it does not say. */
export function parseTitle(title: string): { year: number; period: number } | null {
  const year = /\d{4}/.exec(title)?.[0];
  const period = PERIODS.findIndex((name) => title.includes(name));
  return year && period >= 0 ? { year: Number(year), period } : null;
}

/** Whether a name belongs to an account: an account with only a first name takes that first name. */
export function sameOwner(owner: string, account: string): boolean {
  const left = owner.trim().toLocaleLowerCase('de');
  const right = account.trim().toLocaleLowerCase('de');
  if (!left || !right) return false;
  return left === right || (!right.includes(' ') && left.split(' ')[0] === right);
}

export function sumsOf(statement: Statement): StatementSums {
  const hours = roundCents(statement.lines.reduce((sum, line) => sum + line.minutes / 60, 0));
  const pay = roundCents(hours * statement.rate);
  const car = roundCents(statement.km * statement.kmRate);
  const extra = roundCents(statement.extra);
  return { hours, pay, car, extra, total: roundCents(pay + car + extra) };
}

/** Hours with a comma: 1,5. */
export function hoursText(hours: number): string {
  return String(roundCents(hours)).replace('.', ',');
}

export function sortLines(lines: readonly StatementLine[]): StatementLine[] {
  return [...lines].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

/** The rate of the first license in the list whose name is part of the license text. */
export function rateFor(rates: Rates, license: string): number {
  const text = license.trim().toLocaleLowerCase('de');
  if (text) {
    const match = rates.licenses.find(
      (entry) => entry.name && text.includes(entry.name.toLocaleLowerCase('de')),
    );
    if (match) return match.rate;
  }
  return rates.hourly;
}

/** "Trainer C | 12" per line; lines without a name are dropped. */
export function parseLicenseRates(lines: readonly string[]): LicenseRate[] {
  return lines
    .map((line) => {
      const [name = '', rate = ''] = line.split('|');
      return { name: name.trim(), rate: Number(rate.replace(',', '.')) || 0 };
    })
    .filter((entry) => entry.name !== '');
}

export function licenseRateLines(licenses: readonly LicenseRate[]): string[] {
  return licenses.map((entry) => `${entry.name} | ${entry.rate}`);
}

export function emptyLine(date: string): StatementLine {
  return { id: '', date, time: '', minutes: 60, group: '', place: '' };
}
