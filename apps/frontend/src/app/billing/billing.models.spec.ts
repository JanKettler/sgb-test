import {
  Rates,
  Statement,
  StatementLine,
  hoursText,
  inPeriod,
  licenseRateLines,
  parseLicenseRates,
  parseTitle,
  periodIndex,
  periodTitle,
  rateFor,
  sameOwner,
  sortLines,
  sumsOf,
} from './billing.models';

function line(id: string, date: string, time: string, minutes: number): StatementLine {
  return { id, date, time, minutes, group: '', place: '' };
}

function statement(change: Partial<Statement>): Statement {
  return {
    id: 's',
    owner: 'Jonas Weber',
    title: 'Mai - Sep 2026',
    state: 'draft',
    name: 'Jonas Weber',
    edv: '',
    license: '',
    rate: 12,
    km: 0,
    kmRate: 0.3,
    carText: '',
    extra: 0,
    extraText: '',
    accountHolder: '',
    iban: '',
    bic: '',
    lines: [],
    paidOn: '',
    paidBy: '',
    changed: 1,
    ...change,
  };
}

const RATES: Rates = {
  hourly: 12,
  km: 0.3,
  driveFee: 6,
  drivers: [],
  licenses: [
    { name: 'Trainer B', rate: 15 },
    { name: 'Trainer C', rate: 13 },
  ],
};

describe('billing models', () => {
  it('splits the year into three periods', () => {
    expect(periodIndex('2026-01-15')).toBe(0);
    expect(periodIndex('2026-04-30')).toBe(0);
    expect(periodIndex('2026-05-01')).toBe(1);
    expect(periodIndex('2026-08-31')).toBe(1);
    expect(periodIndex('2026-09-01')).toBe(2);
    expect(periodIndex('2026-12-24')).toBe(2);
    expect(periodTitle('2026-06-10')).toBe('Mai - Sep 2026');
  });

  it('checks whether a date lies in a period of a year or anywhere in the year', () => {
    expect(inPeriod('2026-06-10', 2026, 1)).toBe(true);
    expect(inPeriod('2026-06-10', 2026, 0)).toBe(false);
    expect(inPeriod('2026-06-10', 2025, 1)).toBe(false);
    expect(inPeriod('2026-06-10', 2026, 3)).toBe(true);
    expect(inPeriod('2025-06-10', 2026, 3)).toBe(false);
  });

  it('reads year and period from a title', () => {
    expect(parseTitle('Mai - Sep 2026')).toEqual({ year: 2026, period: 1 });
    expect(parseTitle('Jan - Mai 2025')).toEqual({ year: 2025, period: 0 });
    expect(parseTitle('Sep - Dez 2025')).toEqual({ year: 2025, period: 2 });
    expect(parseTitle('Herbst')).toBeNull();
    expect(parseTitle('Mai - Sep')).toBeNull();
  });

  it('lets an account with only a first name match the first name of a person', () => {
    expect(sameOwner('Jonas Weber', 'Jonas')).toBe(true);
    expect(sameOwner('Jonas Weber', 'jonas weber')).toBe(true);
    expect(sameOwner('Jonas Weber', 'Jonas Meier')).toBe(false);
    expect(sameOwner('Jonas', 'Jonas Weber')).toBe(false);
    expect(sameOwner('Maria', 'Maria')).toBe(true);
    expect(sameOwner('', 'Maria')).toBe(false);
    expect(sameOwner('Maria', '')).toBe(false);
  });

  it('adds up hours, pay, kilometres and other costs', () => {
    const sums = sumsOf(
      statement({
        rate: 12,
        km: 24,
        kmRate: 0.3,
        extra: 5,
        lines: [
          line('a', '2026-06-01', '17:00', 60),
          line('b', '2026-06-02', '17:00', 90),
          line('c', '2026-06-03', '17:00', 45),
        ],
      }),
    );
    expect(sums).toEqual({ hours: 3.25, pay: 39, car: 7.2, extra: 5, total: 51.2 });
  });

  it('gives zero for a statement without lines', () => {
    expect(sumsOf(statement({}))).toEqual({ hours: 0, pay: 0, car: 0, extra: 0, total: 0 });
  });

  it('writes hours with a comma and at most two decimals', () => {
    expect(hoursText(1.5)).toBe('1,5');
    expect(hoursText(2)).toBe('2');
    expect(hoursText(1 / 3)).toBe('0,33');
  });

  it('sorts the lines by date and time', () => {
    const sorted = sortLines([
      line('c', '2026-06-02', '18:00', 60),
      line('a', '2026-06-01', '17:30', 60),
      line('b', '2026-06-02', '09:00', 60),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });

  it('takes the rate of the license whose name is part of the text', () => {
    expect(rateFor(RATES, 'Trainer C (DSV)')).toBe(13);
    expect(rateFor(RATES, 'trainer b')).toBe(15);
    expect(rateFor(RATES, '')).toBe(12);
    expect(rateFor(RATES, 'Schiedsrichter')).toBe(12);
  });

  it('reads the license rates from lines and writes them back', () => {
    const rates = parseLicenseRates(['Trainer C | 12', 'Assistent|8,5', ' | 3', 'Ohne Satz']);
    expect(rates).toEqual([
      { name: 'Trainer C', rate: 12 },
      { name: 'Assistent', rate: 8.5 },
      { name: 'Ohne Satz', rate: 0 },
    ]);
    expect(licenseRateLines(rates)).toEqual(['Trainer C | 12', 'Assistent | 8.5', 'Ohne Satz | 0']);
  });
});
