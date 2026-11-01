import { XlsxBook, XlsxSheet } from '../competition/xlsx';
import { fullDate } from '../training/training-dates';
import { Borrower, MemberMaterial } from './equipment.store';
import { EquipmentItem, availableOf, loanText, missingOf } from './equipment.models';

function date(iso: string): string {
  return iso ? fullDate(iso) : '';
}

/** All items with stock and what is available. */
export function itemsBook(items: readonly EquipmentItem[], today: string): XlsxBook {
  return {
    title: 'Materialliste',
    subtitle: `Stand ${date(today)}`,
    sheets: [
      {
        name: 'Material',
        orientation: 'portrait',
        head: [
          'Gegenstand',
          'Kategorie',
          'Lagerort',
          'Bestand',
          'Einheit',
          'Verfügbar',
          'Mindestbestand',
        ],
        widths: [28, 14, 16, 9, 9, 10, 15],
        formats: ['text', 'text', 'text', 'number', 'text', 'number', 'number'],
        rows: items.map((item) => [
          item.title,
          item.category,
          item.place,
          item.stock,
          item.unit,
          availableOf(item),
          item.minimum,
        ]),
      },
    ],
  };
}

/** Who has what: the loans of the club and, if there are any, the entries of the member list. */
export function borrowersBook(
  borrowers: readonly Borrower[],
  memberMaterial: readonly MemberMaterial[],
  today: string,
): XlsxBook {
  const sheets: XlsxSheet[] = [
    {
      name: 'Verliehen',
      head: ['Wer', 'Was', 'Ausgabedatum', 'Rückgabedatum'],
      widths: [26, 40, 15, 15],
      formats: ['text', 'text', 'date', 'date'],
      rows: borrowers.flatMap((borrower) =>
        borrower.loans.map(({ item, loan }) => [
          borrower.name,
          loanText(item, loan),
          date(loan.since),
          date(loan.until),
        ]),
      ),
    },
  ];
  if (memberMaterial.length > 0) {
    sheets.push({
      name: 'Mitgliederliste',
      head: ['Name', 'Material', 'Ausgabedatum'],
      widths: [26, 30, 15],
      formats: ['text', 'text', 'date'],
      rows: memberMaterial.map((entry) => [entry.name, entry.material, date(entry.since)]),
    });
  }
  return { title: 'Wer hat was', subtitle: `Stand ${date(today)}`, sheets };
}

/** The shopping list with the amount that is missing, and a column to tick off. */
export function shoppingBook(items: readonly EquipmentItem[], today: string): XlsxBook {
  return {
    title: 'Einkaufsliste Material',
    subtitle: `Stand ${date(today)}`,
    sheets: [
      {
        name: 'Einkaufsliste',
        head: ['Gegenstand', 'Menge', 'Einheit', 'Lagerort', 'Erledigt'],
        widths: [34, 10, 12, 20, 12],
        formats: ['text', 'number', 'text', 'text', 'center'],
        rows: items.map((item) => [item.title, missingOf(item) || '', item.unit, item.place, '']),
      },
    ],
  };
}
