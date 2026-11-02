import { XlsxBook, XlsxSheet } from '../competition/xlsx';
import { fullDate } from '../training/training-dates';
import { CashBookRow } from './cash.store';
import { BADGE_STATE_LABEL, BadgeKind, BadgeRecord } from './youth.models';
import { SummaryRow } from './youth.store';

function date(iso: string): string {
  return iso ? fullDate(iso) : '';
}

/**
 * The badges that are not paid yet: one sheet with everybody and, for every badge that has
 * requirements, one sheet with a column per requirement and a tick where it is done.
 */
export function openBadgesBook(
  records: readonly BadgeRecord[],
  kindOf: (name: string) => BadgeKind,
  priceOf: (record: BadgeRecord) => number,
  today: string,
): XlsxBook {
  const open = records
    .filter((record) => record.state !== 'bezahlt')
    .sort((a, b) => b.state.localeCompare(a.state) || a.name.localeCompare(b.name, 'de'));
  const sheets: XlsxSheet[] = [
    {
      name: 'Offen',
      orientation: 'landscape',
      head: ['Name', 'Mitgl.-Nr.', 'Abzeichen', 'Stand', 'Fortschritt', 'Preis', 'Datum', 'Notiz'],
      widths: [26, 12, 20, 26, 14, 10, 12, 34],
      formats: ['text', 'text', 'text', 'text', 'text', 'euro', 'date', 'text'],
      rows: open.map((record) => {
        const kind = kindOf(record.badge);
        const done = kind.requirements.filter((_, index) => record.done.includes(index)).length;
        return [
          record.name,
          record.memberNo,
          record.badge,
          BADGE_STATE_LABEL[record.state],
          kind.requirements.length > 0 ? `${done} von ${kind.requirements.length}` : '',
          priceOf(record),
          date(record.date),
          record.note,
        ];
      }),
    },
  ];
  for (const badge of new Set(open.map((record) => record.badge))) {
    const kind = kindOf(badge);
    if (kind.requirements.length === 0) continue;
    sheets.push({
      name: badge,
      orientation: 'landscape',
      head: ['Name', 'Mitgl.-Nr.', 'Stand', ...kind.requirements],
      widths: [26, 12, 26, ...kind.requirements.map((text) => text.length + 3)],
      formats: ['text', 'text', 'text', ...kind.requirements.map(() => 'center' as const)],
      rows: open
        .filter((record) => record.badge === badge)
        .map((record) => [
          record.name,
          record.memberNo,
          BADGE_STATE_LABEL[record.state],
          ...kind.requirements.map((_, index) => (record.done.includes(index) ? '✓' : '')),
        ]),
    });
  }
  return { title: 'Offene Schwimmabzeichen', subtitle: `Stand ${date(today)}`, sheets };
}

/** The settlement of the badges that were paid in a year. */
export function badgeSummaryBook(
  rows: readonly SummaryRow[],
  year: number,
  today: string,
): XlsxBook {
  const total = rows.reduce((sum, row) => sum + row.sum, 0);
  return {
    title: `Abrechnung Abzeichen ${year}`,
    subtitle: `Stand ${date(today)}`,
    sheets: [
      {
        name: 'Abzeichen',
        head: ['Abzeichen', 'Kosten', 'Anzahl', 'Gesamt', 'Namen'],
        widths: [22, 12, 9, 14, 70],
        formats: ['text', 'euro', 'number', 'euro', 'text'],
        rows: [
          ...rows.map((row) => [
            row.badge,
            row.price,
            row.count || null,
            row.sum,
            row.names.join(', '),
          ]),
          ['Summe', null, null, total, ''],
        ],
      },
    ],
  };
}

/** The cash book of a year: the balance carried over, then every confirmed booking. */
export function cashBookBook(
  year: number,
  start: number,
  rows: readonly CashBookRow[],
  today: string,
): XlsxBook {
  return {
    title: `Kassenbuch Jugendkasse ${year}`,
    subtitle: `Stand ${date(today)}`,
    sheets: [
      {
        name: 'Kassenbuch',
        head: ['Datum', 'Buchungstext', 'Beleg', 'Betrag', 'Kassenstand'],
        widths: [12, 46, 12, 12, 14],
        formats: ['date', 'text', 'text', 'euro', 'euro'],
        rows: [
          [`01.01.${year}`, 'Übertrag', '', null, start],
          ...rows.map((row) => [date(row.date), row.text, row.receipt, row.amount, row.balance]),
        ],
      },
    ],
  };
}
