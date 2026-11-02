import { createXlsx } from '../competition/xlsx';
import { drivesBook, statementBook } from './billing.export';
import { fileName } from './billing.files';
import { Drive, EMPTY_PROFILE, Statement } from './billing.models';
import { drivesHtml, statementHtml } from './billing.print';

const STATEMENT: Statement = {
  id: 's-1',
  owner: 'Jonas Weber',
  title: 'Mai - Sep 2026',
  state: 'draft',
  name: 'Jonas Weber',
  edv: '4711-12',
  license: 'Trainer C',
  rate: 12,
  km: 24,
  kmRate: 0.3,
  carText: 'Lehrgang',
  extra: 5,
  extraText: 'Porto',
  accountHolder: 'Familie Weber',
  iban: 'DE89 3704 0044 0532 0130 00',
  bic: 'COBADEFFXXX',
  lines: [
    { id: 'a', date: '2026-06-02', time: '17:30', minutes: 60, group: 'Gruppe 1', place: 'Roshop' },
    { id: 'b', date: '2026-06-09', time: '17:30', minutes: 90, group: 'Gruppe 2', place: 'Delfin' },
    { id: 'c', date: '2026-06-16', time: '18:00', minutes: 45, group: 'WK', place: 'Roshop' },
  ],
  paidOn: '',
  paidBy: '',
  changed: 1,
};

const DRIVES: Drive[] = [
  {
    id: 'f-2',
    owner: 'Anna Brandt',
    date: '2026-06-09',
    note: 'Wettkampftraining, Delfin',
    amount: 6,
    state: 'open',
    settledOn: '',
  },
  {
    id: 'f-1',
    owner: 'Anna Brandt',
    date: '2026-06-02',
    note: 'Wettkampftraining, Roshop',
    amount: 6,
    state: 'open',
    settledOn: '',
  },
];

const PROFILE = { ...EMPTY_PROFILE, iban: 'DE02 1203 0000 0000 2020 51', bic: 'BYLADEM1001' };

describe('billing exports', () => {
  it('writes the units and the amounts of a statement', () => {
    const book = statementBook(STATEMENT);
    expect(book.title).toBe('Trainerabrechnung');
    expect(book.subtitle).toBe('Mai - Sep 2026 · Jonas Weber');
    expect(book.sheets.map((sheet) => sheet.name)).toEqual(['Einheiten', 'Abrechnung']);
    const units = book.sheets[0]!;
    expect(units.rows).toHaveLength(3);
    expect(units.rows[1]).toEqual([expect.any(String), '17:30', 90, 1.5, 'Gruppe 2', 'Delfin']);
    const amounts = book.sheets[1]!.rows;
    expect(amounts[0]).toEqual(['Training gesamt', '3,25 Std.', '12,00 € pro Stunde', 39]);
    expect(amounts[1]).toEqual(['PKW: Lehrgang', '24 km', '0,30 € pro km', 7.2]);
    expect(amounts[2]).toEqual(['Sonstiges: Porto', '', '', 5]);
    expect(amounts[3]).toEqual(['Gesamtbetrag', '', '', 51.2]);
    expect(amounts.find((row) => row[0] === 'Kontoinhaber')?.[1]).toBe('Familie Weber');
    expect(amounts.find((row) => row[0] === 'IBAN')?.[1]).toBe('DE89 3704 0044 0532 0130 00');
  });

  it('leaves out the other costs when there are none', () => {
    const book = statementBook({ ...STATEMENT, extra: 0, extraText: '' });
    expect(book.sheets[1]!.rows.some((row) => String(row[0]).startsWith('Sonstiges'))).toBe(false);
  });

  it('keeps every heading in one line and makes a file Excel can open', () => {
    for (const book of [statementBook(STATEMENT), drivesBook('Anna Brandt', DRIVES, PROFILE)]) {
      for (const sheet of book.sheets) {
        for (const heading of sheet.head) expect(heading).not.toMatch(/\n/);
        expect(sheet.widths).toHaveLength(sheet.head.length);
      }
      const bytes = createXlsx(book);
      expect(String.fromCharCode(bytes[0]!, bytes[1]!)).toBe('PK');
    }
  });

  it('lists the drives by date with the sum and the bank data in the header', () => {
    const book = drivesBook('Anna Brandt', DRIVES, PROFILE);
    expect(book.title).toBe('Fahrtenformular Wettkampftraining');
    expect(book.subtitle).toBe(
      'Anna Brandt · Anna Brandt · DE02 1203 0000 0000 2020 51 / BYLADEM1001',
    );
    const rows = book.sheets[0]!.rows;
    expect(rows).toHaveLength(3);
    expect(rows[0]![0]).toBe(1);
    expect(rows[0]![2]).toBe('Wettkampftraining, Roshop');
    expect(rows[2]).toEqual(['', '', 'Summe (2 Fahrten)', 12]);
  });

  it('leaves the bank data out of the header when there is none', () => {
    expect(drivesBook('Anna Brandt', DRIVES, EMPTY_PROFILE).subtitle).toBe('Anna Brandt');
  });

  it('turns words into a file name', () => {
    expect(fileName('Mai - Sep 2026', 'Jonas Weber')).toBe('Mai_Sep_2026_Jonas_Weber');
    expect(fileName('Köhler')).toBe('Köhler');
  });
});

describe('billing print forms', () => {
  it('prints the statement with the sums, the bank data and the signature line', () => {
    const html = statementHtml(STATEMENT, '2026-09-30');
    expect(html).toContain('<h1>Trainerabrechnung</h1><div class="sub">Mai - Sep 2026</div>');
    expect(html).toContain('<b>Name:</b> Jonas Weber');
    expect(html).toContain('4711-12');
    expect(html).toContain('3,25');
    expect(html).toContain('51,20 €');
    expect(html).toContain('24 km á 0,30 €');
    expect(html).toContain('Lehrgang');
    expect(html).toContain('DE89 3704 0044 0532 0130 00');
    expect(html).toContain('Kontoinhaber: Familie Weber');
    expect(html).toContain('(Unterschrift)');
  });

  it('pads the table of units to a full page', () => {
    const html = statementHtml(STATEMENT, '2026-09-30');
    const body = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'));
    expect(body.match(/<tr>/g)).toHaveLength(15);
  });

  it('writes empty lines for the bank data that is missing and escapes names', () => {
    const html = statementHtml(
      { ...STATEMENT, name: 'A <b>B</b>', iban: '', bic: '', accountHolder: '' },
      '2026-09-30',
    );
    expect(html).toContain('A &lt;b&gt;B&lt;/b&gt;');
    expect(html).not.toContain('A <b>B</b>');
    expect(html).toContain('IBAN: <b>______________________</b>');
  });

  it('prints the form for the flat fees', () => {
    const html = drivesHtml('Anna Brandt', DRIVES, PROFILE, '2026-09-30');
    expect(html).toContain('<h1>Fahrtenformular</h1>');
    expect(html).toContain('DE02 1203 0000 0000 2020 51 / BYLADEM1001');
    expect(html).toContain('Summe (2 Fahrten)');
    expect(html).toContain('12,00 €');
    expect(html.indexOf('Wettkampftraining, Roshop')).toBeLessThan(
      html.indexOf('Wettkampftraining, Delfin'),
    );
  });
});
