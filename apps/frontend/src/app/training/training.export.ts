import { XlsxBook, XlsxFormat, fitWidths } from '../competition/xlsx';
import { fullDate } from './training-dates';

/** Names as rows, sessions as columns: the first heading is "Name", the others are the sessions. */
export interface AttendanceTable {
  head: string[];
  rows: string[][];
}

/**
 * The attendance list of one group. A blank list has taller rows, so that the trainer can fill it
 * in by hand; a filled one shows present, missing or excused for every session.
 */
export function attendanceBook(
  groupName: string,
  table: AttendanceTable,
  from: string,
  to: string,
  blank: boolean,
): XlsxBook {
  const sessions = table.head.length - 1;
  const formats: XlsxFormat[] = ['text', ...Array<XlsxFormat>(sessions).fill('center')];
  return {
    title: blank ? 'Anwesenheitsliste zum Ausfüllen' : 'Anwesenheitsliste',
    subtitle: `${groupName}, ${fullDate(from)} bis ${fullDate(to)}`,
    sheets: [
      {
        name: 'Anwesenheit',
        orientation: 'landscape',
        head: table.head,
        widths: fitWidths(table.head, [28, ...Array<number>(sessions).fill(14)]),
        formats,
        rowHeight: blank ? 24 : undefined,
        rows: table.rows,
      },
    ],
  };
}

export function attendanceFileName(groupId: string, from: string, to: string): string {
  return `Anwesenheit_${groupId}_${from}_${to}.xlsx`;
}
