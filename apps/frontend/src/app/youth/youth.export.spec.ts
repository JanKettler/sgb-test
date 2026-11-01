import { TestBed } from '@angular/core/testing';
import { CashStore } from './cash.store';
import { badgeSummaryBook, cashBookBook, openBadgesBook } from './youth.export';
import { YouthStore } from './youth.store';

describe('youth Excel lists', () => {
  function create() {
    TestBed.resetTestingModule();
    return { youth: TestBed.inject(YouthStore), cash: TestBed.inject(CashStore) };
  }

  const open = (youth: YouthStore) =>
    openBadgesBook(
      youth.records(),
      (name) => youth.kindOf(name),
      (record) => youth.priceOf(record),
      '2026-11-02',
    );

  it('lists the open badges: in work first, then the ones waiting for payment', () => {
    const { youth } = create();
    const book = open(youth);
    expect(book.title).toBe('Offene Schwimmabzeichen');
    expect(book.subtitle).toBe('Stand 02.11.2026');
    const rows = book.sheets[0].rows;
    expect(rows.map((row) => `${row[0]} · ${row[3]}`)).toEqual([
      'Anna Brandt · In Arbeit',
      'Mia Vogel · In Arbeit',
      'Tobias Lorenz · In Arbeit',
      'Mats Hartmann · Bestanden, Zahlung offen',
    ]);
    expect(rows[1][4]).toBe('3 von 5');
    expect(rows[3][5]).toBe(2);
  });

  it('adds a sheet per badge with a tick for every requirement that is done', () => {
    const { youth } = create();
    const sheets = open(youth).sheets;
    expect(sheets.map((sheet) => sheet.name)).toEqual([
      'Offen',
      'DSA Gold',
      'DSA Bronze',
      'Totenkopf 1 Std.',
      'DSA Silber',
    ]);
    const bronze = sheets[2];
    expect(bronze.head).toHaveLength(3 + 5);
    expect(bronze.rows[0].slice(3)).toEqual(['✓', '✓', '', '✓', '']);
    expect(bronze.formats?.slice(3)).toEqual(['center', 'center', 'center', 'center', 'center']);
  });

  it('keeps out the badges without requirements', () => {
    const { youth } = create();
    youth.records.update((list) =>
      list.map((record) =>
        record.id === 'r-3' ? { ...record, state: 'laufend' as const } : record,
      ),
    );
    expect(open(youth).sheets.map((sheet) => sheet.name)).not.toContain('DLA Hai');
  });

  it('writes the settlement of a year with the sum in the last row', () => {
    const { youth } = create();
    const year = Number(youth.today.slice(0, 4));
    const book = badgeSummaryBook(youth.summaryOf(year), year, '2026-11-02');
    expect(book.title).toBe(`Abrechnung Abzeichen ${year}`);
    const rows = book.sheets[0].rows;
    expect(rows).toHaveLength(10);
    expect(rows.find((row) => row[0] === 'DLA Hai')).toEqual(['DLA Hai', 3, 1, 3, 'Mira Köhler']);
    expect(rows.find((row) => row[0] === 'DSA Gold')?.[2]).toBeNull();
    expect(rows.at(-1)).toEqual(['Summe', null, null, 3, '']);
  });

  it('writes the cash book with the balance carried over first', () => {
    const { cash } = create();
    const year = Number(cash.today.slice(0, 4));
    const { start, rows } = cash.bookOf(year);
    const book = cashBookBook(year, start, rows, '2026-11-02');
    expect(book.title).toBe(`Kassenbuch Jugendkasse ${year}`);
    const sheet = book.sheets[0];
    expect(sheet.head).toEqual(['Datum', 'Buchungstext', 'Beleg', 'Betrag', 'Kassenstand']);
    expect(sheet.rows[0]).toEqual([`01.01.${year}`, 'Übertrag', '', null, start]);
    expect(sheet.rows).toHaveLength(rows.length + 1);
  });
});
