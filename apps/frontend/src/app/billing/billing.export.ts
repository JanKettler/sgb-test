import { XlsxBook } from '../competition/xlsx';
import { euro } from '../core/money';
import { fullDate } from '../training/training-dates';
import { Drive, Profile, Statement, hoursText, sumsOf } from './billing.models';

/** A statement as an Excel list: the units on one sheet, the amounts and bank data on the other. */
export function statementBook(statement: Statement): XlsxBook {
  const sums = sumsOf(statement);
  const kmText = statement.km > 0 ? `${String(statement.km).replace('.', ',')} km` : '';
  const withText = (label: string, text: string) => (text ? `${label}: ${text}` : label);
  const rows: (string | number | null)[][] = [
    [
      'Training gesamt',
      `${hoursText(sums.hours)} Std.`,
      `${euro(statement.rate)} pro Stunde`,
      sums.pay,
    ],
    [withText('PKW', statement.carText), kmText, `${euro(statement.kmRate)} pro km`, sums.car],
  ];
  if (statement.extra > 0 || statement.extraText) {
    rows.push([withText('Sonstiges', statement.extraText), '', '', sums.extra]);
  }
  rows.push(['Gesamtbetrag', '', '', sums.total], ['', '', '', null]);
  rows.push(
    ['Name', statement.name || statement.owner, '', null],
    ['ÜL-EDV-Nr.', statement.edv, '', null],
    ['Lizenz', statement.license, '', null],
    ['Kontoinhaber', statement.accountHolder || statement.name || statement.owner, '', null],
    ['IBAN', statement.iban, '', null],
    ['BIC', statement.bic, '', null],
  );
  return {
    title: 'Trainerabrechnung',
    subtitle: `${statement.title} · ${statement.name || statement.owner}`,
    sheets: [
      {
        name: 'Einheiten',
        orientation: 'portrait',
        head: ['Datum', 'Beginn', 'Minuten', 'Stunden', 'Gruppe', 'Ort'],
        widths: [14, 10, 10, 10, 26, 28],
        formats: ['date', 'center', 'number', 'number', 'text', 'text'],
        rows: statement.lines.map((line) => [
          fullDate(line.date),
          line.time,
          line.minutes,
          Math.round((line.minutes / 60) * 100) / 100,
          line.group,
          line.place,
        ]),
      },
      {
        name: 'Abrechnung',
        orientation: 'portrait',
        head: ['Position', 'Angabe', 'Satz', 'Betrag'],
        widths: [36, 30, 22, 14],
        formats: ['text', 'text', 'text', 'euro'],
        rows,
      },
    ],
  };
}

/** The drives of one person as the form for the flat fees, with the bank data in the header. */
export function drivesBook(owner: string, drives: readonly Drive[], profile: Profile): XlsxBook {
  const sorted = [...drives].sort((a, b) => a.date.localeCompare(b.date));
  const sum = sorted.reduce((total, drive) => total + drive.amount, 0);
  const bank = profile.iban
    ? ` · ${profile.accountHolder || owner} · ${profile.iban}${profile.bic ? ` / ${profile.bic}` : ''}`
    : '';
  return {
    title: 'Fahrtenformular Wettkampftraining',
    subtitle: `${owner}${bank}`,
    sheets: [
      {
        name: 'Fahrten',
        orientation: 'portrait',
        head: ['Nr.', 'Datum', 'Bemerkung', 'Pauschale'],
        widths: [6, 14, 44, 14],
        formats: ['center', 'date', 'text', 'euro'],
        rows: [
          ...sorted.map((drive, index) => [
            index + 1,
            fullDate(drive.date),
            drive.note,
            drive.amount,
          ]),
          ['', '', `Summe (${sorted.length} ${sorted.length === 1 ? 'Fahrt' : 'Fahrten'})`, sum],
        ],
      },
    ],
  };
}
