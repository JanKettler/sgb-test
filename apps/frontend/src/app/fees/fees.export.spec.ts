import { XlsxBook, createXlsx, headWidth } from '../competition/xlsx';
import {
  DunningLine,
  FeeTypeLine,
  PaymentLine,
  dunningBook,
  feeTypesBook,
  paymentsBook,
} from './fees.export';

const payments: PaymentLine[] = [
  {
    label: 'Lena Muster',
    payer: 'Maria Beispiel',
    fee: 'Jugend',
    amount: 60,
    status: 'bezahlt am 03.03.2026',
    method: 'Lastschrift',
    level: 0,
    purpose: 'Beitrag 2026 Lena Muster',
  },
  {
    label: 'Tim Probst',
    payer: 'Sabine Probst',
    fee: 'Familie',
    amount: 96.5,
    status: 'offen',
    method: 'Überweisung',
    level: 1,
    purpose: 'Beitrag 2026 Tim Probst',
  },
];

function headingsFit(book: XlsxBook): void {
  for (const sheet of book.sheets) {
    sheet.head.forEach((text, index) => {
      expect((sheet.widths?.[index] ?? 0) >= headWidth(text)).toBe(true);
    });
  }
}

describe('fee exports', () => {
  it('writes one row per payment with the amount as a number', () => {
    const book = paymentsBook(payments, '2026-11-02');
    expect(book.title).toBe('Beitragszahlungen');
    expect(book.subtitle).toBe('Stand 02.11.2026, 2 Zahlungen');
    const [sheet] = book.sheets;
    expect(sheet.head[3]).toBe('Betrag');
    expect(sheet.formats?.[3]).toBe('euro');
    expect(sheet.rows[1]).toEqual([
      'Tim Probst',
      'Sabine Probst',
      'Familie',
      96.5,
      'offen',
      'Überweisung',
      1,
      'Beitrag 2026 Tim Probst',
    ]);
    headingsFit(book);
    expect(createXlsx(book).length).toBeGreaterThan(500);
  });

  it('writes the reminders with open amount, fee and total', () => {
    const lines: DunningLine[] = [
      { payer: 'Sabine Probst', person: 'Tim Probst', open: 96.5, fee: 5, total: 101.5, level: 1 },
    ];
    const book = dunningBook(lines, '2026-11-02');
    expect(book.sheets[0].head).toEqual(['Zahler', 'Person', 'Offen', 'Gebühr', 'Gesamt', 'Stufe']);
    expect(book.sheets[0].rows).toEqual([['Sabine Probst', 'Tim Probst', 96.5, 5, 101.5, 1]]);
    headingsFit(book);
    expect(createXlsx(book).length).toBeGreaterThan(500);
  });

  it('writes the fee types with the number of payers', () => {
    const lines: FeeTypeLine[] = [
      { name: 'Jugend', rule: 'Jahrgang 2007 und jünger', amount: 60, payers: 41 },
    ];
    const book = feeTypesBook(lines, '2026-11-02');
    expect(book.sheets[0].rows).toEqual([['Jugend', 'Jahrgang 2007 und jünger', 60, 41]]);
    headingsFit(book);
    expect(createXlsx(book).length).toBeGreaterThan(500);
  });

  it('writes an empty list as a table with headings only', () => {
    const book = paymentsBook([], '2026-11-02');
    expect(book.sheets[0].rows).toEqual([]);
    expect(createXlsx(book).length).toBeGreaterThan(500);
  });
});
