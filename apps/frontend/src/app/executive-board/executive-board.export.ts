import { XlsxBook } from '../competition/xlsx';
import { fullDate } from '../training/training-dates';
import { RESOLUTION_LABEL, Resolution } from './executive-board.models';

function date(iso: string): string {
  return iso ? fullDate(iso) : '';
}

/** The decisions of the board with who is responsible and until when. */
export function resolutionsBook(resolutions: readonly Resolution[], today: string): XlsxBook {
  return {
    title: 'Beschlussliste',
    subtitle: `Stand ${date(today)}`,
    sheets: [
      {
        name: 'Beschlüsse',
        head: ['Nummer', 'Beschluss', 'Datum', 'Zuständig', 'Frist', 'Stand', 'Text'],
        widths: [10, 44, 12, 22, 12, 12, 60],
        formats: ['text', 'text', 'date', 'text', 'date', 'text', 'text'],
        rows: resolutions.map((entry) => [
          entry.number,
          entry.title,
          date(entry.date),
          entry.who.join(', '),
          date(entry.due),
          RESOLUTION_LABEL[entry.state],
          entry.text,
        ]),
      },
    ],
  };
}
