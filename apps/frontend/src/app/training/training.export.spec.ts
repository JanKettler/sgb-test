import { createXlsx, headWidth } from '../competition/xlsx';
import { AttendanceTable, attendanceBook, attendanceFileName } from './training.export';

const table: AttendanceTable = {
  head: ['Name', 'Mo. 02.11. 17:00', 'Mi. 04.11. 18:30'],
  rows: [
    ['Lena Muster', 'anwesend', 'fehlt'],
    ['Tim Probst', 'abgemeldet', ''],
  ],
};

describe('attendance export', () => {
  it('writes names as rows and sessions as columns', () => {
    const book = attendanceBook('Wettkampfgruppe', table, '2026-11-02', '2026-11-08', false);
    expect(book.title).toBe('Anwesenheitsliste');
    expect(book.subtitle).toBe('Wettkampfgruppe, 02.11.2026 bis 08.11.2026');
    const [sheet] = book.sheets;
    expect(sheet.head).toEqual(table.head);
    expect(sheet.rows).toEqual(table.rows);
    expect(sheet.formats).toEqual(['text', 'center', 'center']);
    expect(sheet.rowHeight).toBeUndefined();
  });

  it('leaves room for handwriting in a blank list', () => {
    const book = attendanceBook('Wettkampfgruppe', table, '2026-11-02', '2026-11-08', true);
    expect(book.title).toBe('Anwesenheitsliste zum Ausfüllen');
    expect(book.sheets[0].rowHeight).toBeGreaterThan(15);
  });

  it('keeps every session heading on one line', () => {
    const [sheet] = attendanceBook(
      'Wettkampfgruppe',
      table,
      '2026-11-02',
      '2026-11-08',
      false,
    ).sheets;
    sheet.head.forEach((text, index) => {
      expect((sheet.widths?.[index] ?? 0) >= headWidth(text)).toBe(true);
    });
    expect(createXlsx({ title: 't', subtitle: 's', sheets: [sheet] }).length).toBeGreaterThan(500);
  });

  it('writes a list without sessions as a table with the name column only', () => {
    const empty: AttendanceTable = { head: ['Name'], rows: [['Lena Muster']] };
    const book = attendanceBook('Wettkampfgruppe', empty, '2026-11-02', '2026-11-08', true);
    expect(book.sheets[0].formats).toEqual(['text']);
    expect(createXlsx(book).length).toBeGreaterThan(500);
  });

  it('names the file by group and period', () => {
    expect(attendanceFileName('WK', '2026-11-02', '2026-11-08')).toBe(
      'Anwesenheit_WK_2026-11-02_2026-11-08.xlsx',
    );
  });
});
