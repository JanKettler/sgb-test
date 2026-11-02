import { TestBed } from '@angular/core/testing';
import { headWidth } from '../competition/xlsx';
import { borrowersBook, itemsBook, shoppingBook } from './equipment.export';
import { EquipmentStore } from './equipment.store';

describe('equipment Excel lists', () => {
  function create() {
    TestBed.resetTestingModule();
    return TestBed.inject(EquipmentStore);
  }

  it('lists every item with its stock and what is available', () => {
    const store = create();
    const book = itemsBook(store.sorted(), '2026-11-02');
    expect(book.subtitle).toBe('Stand 02.11.2026');
    const sheet = book.sheets[0];
    expect(sheet.head[0]).toBe('Gegenstand');
    expect(sheet.rows).toHaveLength(8);
    const blue = sheet.rows.find((row) => row[0] === 'Schwimmbretter blau');
    expect(blue).toEqual([
      'Schwimmbretter blau',
      'Training',
      'Halle, Schrank 1',
      24,
      'Stück',
      22,
      20,
    ]);
  });

  it('leaves the minimum empty when there is none', () => {
    const store = create();
    const sheet = itemsBook(store.sorted(), '2026-11-02').sheets[0];
    const cable = sheet.rows.find((row) => row[0] === 'Verlängerungskabel 10 m');
    expect(cable?.[6]).toBeNull();
  });

  it('writes who has what, with dates as real dates', () => {
    const store = create();
    const book = borrowersBook(store.borrowers(), store.memberMaterial(), store.today);
    const loans = book.sheets[0];
    expect(loans.head).toEqual(['Wer', 'Was', 'Ausgabedatum', 'Rückgabedatum']);
    expect(loans.formats).toEqual(['text', 'text', 'date', 'date']);
    expect(loans.rows.map((row) => [row[0], row[1]])).toEqual([
      ['Jonas Weber', 'Stoppuhr Nr. 2'],
      ['Mia Vogel', 'Schwimmbretter blau (2×)'],
    ]);
    expect(book.sheets.map((sheet) => sheet.name)).toContain('Mitgliederliste');
  });

  it('lists the shopping list with the missing amount', () => {
    const store = create();
    const sheet = shoppingBook(store.shopping(), store.today).sheets[0];
    expect(sheet.rows.map((row) => [row[0], row[1]])).toEqual([
      ['Erste-Hilfe-Koffer', ''],
      ['Medaillen', 22],
      ['Verlängerungskabel 10 m', ''],
    ]);
  });

  it('gives every heading enough width to stay on one line', () => {
    const store = create();
    const books = [
      itemsBook(store.sorted(), store.today),
      borrowersBook(store.borrowers(), store.memberMaterial(), store.today),
      shoppingBook(store.shopping(), store.today),
    ];
    for (const sheet of books.flatMap((book) => book.sheets)) {
      expect(sheet.head.length).toBe(sheet.widths?.length);
      for (const head of sheet.head) expect(headWidth(head)).toBeGreaterThan(head.length);
    }
  });
});
