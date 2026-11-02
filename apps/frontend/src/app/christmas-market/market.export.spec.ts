import { createXlsx, headWidth } from '../competition/xlsx';
import { helpersBook, marketFileName, settlementBook, shoppingBook } from './market.export';
import { Counts, financeOf, sturzResult, Sturz, piecesSum } from './market.models';
import {
  sampleDough,
  sampleExpenses,
  sampleProducts,
  sampleSlots,
  sampleStock,
} from './market.sample';

const counts: Counts = {
  'samstag|waffel': { paid: 30, free: 4 },
  'samstag|kinderpunsch': { paid: 20, free: 2 },
};

function settlement(withCount: boolean) {
  const products = sampleProducts();
  const expenses = sampleExpenses('2026-11-02');
  const finance = financeOf(products, counts, { samstag: 7.5, sonntag: 0 }, 45, expenses);
  const empty: Sturz = { start: {}, evening: {}, withdrawals: [] };
  const counted: Sturz = {
    start: { '10': 2 },
    evening: { '100': 1, '50': 1, '5': 1 },
    withdrawals: [],
  };
  const of = (sturz: Sturz, day: 'samstag' | 'sonntag') =>
    sturzResult(sturz, finance.days[day].sales, finance.days[day].donation);
  return settlementBook({
    saturday: '2026-11-28',
    products,
    counts,
    finance,
    expenses,
    sturz: {
      samstag: of(withCount ? counted : empty, 'samstag'),
      sonntag: of(empty, 'sonntag'),
    },
  });
}

function checkHeadings(book: { sheets: { name: string; head: string[]; widths?: number[] }[] }) {
  for (const sheet of book.sheets) {
    sheet.head.forEach((text, index) => {
      expect((sheet.widths?.[index] ?? 0) >= headWidth(text)).toBe(true);
    });
  }
}

describe('market exports', () => {
  it('writes the helper lists of both days and the places for the dough', () => {
    const book = helpersBook('2026-11-28', sampleSlots(), sampleDough());
    expect(book.title).toBe('Helferliste Weihnachtsmarkt');
    expect(book.subtitle).toBe('28.11.2026 und 29.11.2026');
    expect(book.sheets.map((sheet) => sheet.name)).toEqual(['Samstag', 'Sonntag', 'Waffelteig']);
    const saturday = book.sheets[0];
    expect(saturday.head).toEqual(['Zeit', 'Name', 'Aufsicht (Ü18)', 'Hinweis']);
    expect(saturday.rows[0]).toEqual([
      '12:00–14:00',
      'Lena Muster, Tim Probst',
      'Maria Beispiel',
      '',
    ]);
    expect(saturday.rows).toHaveLength(3);
    const dough = book.sheets[2];
    expect(dough.rows).toHaveLength(10);
    expect(dough.rows[0]).toEqual(['Samstag', 1, 'Frieda Lindner']);
    expect(dough.rows[2]).toEqual(['Samstag', 3, 'frei']);
    checkHeadings(book);
    expect(createXlsx(book).length).toBeGreaterThan(500);
  });

  it('writes the accounts: sales, result per day, profit and expenses', () => {
    const book = settlement(false);
    expect(book.sheets.map((sheet) => sheet.name)).toEqual([
      'Verkäufe',
      'Tagesergebnis',
      'Abrechnung',
      'Ausgaben',
    ]);
    const [sales, days, total, expenses] = book.sheets;
    expect(sales.rows).toHaveLength(4);
    expect(sales.rows[0]).toEqual(['Samstag', 'Belgische Waffeln', 2, 30, 4, 60]);
    expect(days.rows[0]).toEqual(['Samstag', 100, 7.5, 107.5]);
    expect(total.rows).toEqual([
      ['Gesamtumsatz', 107.5],
      ['Standgebühr', -45],
      ['Ausgaben gesamt', -31.4],
      ['Gewinn', 31.1],
    ]);
    expect(expenses.rows.map((row) => row[1])).toEqual([
      'Plakate und Flyer drucken',
      'Ersatzteil für ein Waffeleisen',
    ]);
    expect(expenses.rows[0][3]).toBe('ja');
    checkHeadings(book);
    expect(createXlsx(book).length).toBeGreaterThan(500);
  });

  it('adds the cash counts when a day was counted', () => {
    const book = settlement(true);
    const sheet = book.sheets.at(-1)!;
    expect(sheet.name).toBe('Kassensturz');
    expect(sheet.rows).toHaveLength(1);
    expect(piecesSum({ '10': 2 })).toBe(20);
    expect(sheet.rows[0]).toEqual(['Samstag', 20, 100, 7.5, 0, 127.5, 155, 27.5]);
    expect(sheet.head).toContain('Anfangsbestand');
    checkHeadings(book);
  });

  it('writes the shopping list with what is missing and the price', () => {
    const book = shoppingBook(sampleStock());
    const sheet = book.sheets[0];
    expect(sheet.head[0]).toBe('Artikel');
    const flour = sheet.rows.find((row) => row[0] === 'Weizenmehl')!;
    expect(flour).toEqual([
      'Weizenmehl',
      'Zutaten',
      '12 kg',
      '2 kg',
      '10 kg',
      '10 × 1 kg',
      1.29,
      'Kruber',
      12.9,
    ]);
    expect(sheet.rows.some((row) => row[0] === 'Waffeleisen')).toBe(false);
    expect(sheet.rows.some((row) => row[0] === 'Pappbecher')).toBe(true);
    checkHeadings(book);
  });

  it('names the files by kind and year', () => {
    expect(marketFileName('Abrechnung', '2026')).toBe('Abrechnung-Weihnachtsmarkt-2026.xlsx');
  });
});
