import { XlsxBook, XlsxFormat, XlsxSheet, XlsxValue, fitWidths } from '../competition/xlsx';
import { fullDate } from '../training/training-dates';
import {
  Counts,
  DAY_NAME,
  DoughSpot,
  Finance,
  MARKET_DAYS,
  MarketDay,
  MarketExpense,
  Product,
  Slot,
  SturzResult,
  StockItem,
  buyOf,
  dayDate,
  numberText,
  onShoppingList,
  quantity,
  tallyOf,
} from './market.models';

function sheet(
  name: string,
  head: string[],
  wanted: number[],
  formats: XlsxFormat[],
  rows: XlsxValue[][],
): XlsxSheet {
  return {
    name,
    orientation: head.length > 6 ? 'landscape' : 'portrait',
    head,
    widths: fitWidths(head, wanted),
    formats,
    rows,
  };
}

function dates(saturday: string): string {
  return `${fullDate(dayDate(saturday, 'samstag'))} und ${fullDate(dayDate(saturday, 'sonntag'))}`;
}

/** The helper lists of both days and the places for the waffle dough, with the names as written. */
export function helpersBook(
  saturday: string,
  slots: readonly Slot[],
  dough: readonly DoughSpot[],
  supervisorLabel = 'Aufsicht (Ü18)',
): XlsxBook {
  const lines = (day: MarketDay) =>
    slots
      .filter((slot) => slot.day === day)
      .map((slot) => [slot.label, slot.helpers.join(', '), slot.supervisors.join(', '), slot.note]);
  const spots = MARKET_DAYS.flatMap((day) =>
    dough
      .filter((spot) => spot.day === day)
      .sort((a, b) => a.no - b.no)
      .map((spot) => [DAY_NAME[day], spot.no, spot.name || 'frei']),
  );
  return {
    title: 'Helferliste Weihnachtsmarkt',
    subtitle: dates(saturday),
    sheets: [
      ...MARKET_DAYS.map((day) =>
        sheet(
          DAY_NAME[day],
          ['Zeit', 'Name', supervisorLabel, 'Hinweis'],
          [16, 44, 26, 28],
          ['center', 'text', 'text', 'text'],
          lines(day),
        ),
      ),
      sheet('Waffelteig', ['Tag', 'Platz', 'Name'], [14, 8, 40], ['text', 'center', 'text'], spots),
    ],
  };
}

export interface SettlementInput {
  saturday: string;
  products: readonly Product[];
  counts: Counts;
  finance: Finance;
  expenses: readonly MarketExpense[];
  /** The cash count of each day; days without a count are left out. */
  sturz: Readonly<Record<MarketDay, SturzResult>>;
}

/** The accounts of the market: sales, result per day, the profit, the expenses and the cash counts. */
export function settlementBook(input: SettlementInput): XlsxBook {
  const { finance } = input;
  const sales = MARKET_DAYS.flatMap((day) =>
    input.products.map((product) => {
      const tally = tallyOf(input.counts, day, product.id);
      return [
        DAY_NAME[day],
        product.name,
        product.price,
        tally.paid,
        tally.free,
        Math.round(tally.paid * product.price * 100) / 100,
      ];
    }),
  );
  const result = MARKET_DAYS.map((day) => [
    DAY_NAME[day],
    finance.days[day].sales,
    finance.days[day].donation,
    finance.days[day].total,
  ]);
  const counted = MARKET_DAYS.filter((day) => input.sturz[day].done || input.sturz[day].start > 0);
  const sheets: XlsxSheet[] = [
    sheet(
      'Verkäufe',
      ['Tag', 'Produkt', 'Preis', 'bezahlt', 'Helfer (gratis)', 'Umsatz'],
      [12, 24, 12, 10, 16, 14],
      ['text', 'text', 'euro', 'number', 'number', 'euro'],
      sales,
    ),
    sheet(
      'Tagesergebnis',
      ['Tag', 'Verkäufe', 'Spende', 'Summe'],
      [14, 14, 14, 14],
      ['text', 'euro', 'euro', 'euro'],
      result,
    ),
    sheet(
      'Abrechnung',
      ['Position', 'Betrag'],
      [34, 16],
      ['text', 'euro'],
      [
        ['Gesamtumsatz', finance.revenue],
        ['Standgebühr', -finance.fee],
        ['Ausgaben gesamt', -finance.expenses],
        ['Gewinn', finance.profit],
      ],
    ),
    sheet(
      'Ausgaben',
      ['Datum', 'Verwendungszweck', 'Betrag', 'Beleg'],
      [14, 44, 14, 10],
      ['date', 'text', 'euro', 'center'],
      [...input.expenses]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((entry) => [
          entry.date ? fullDate(entry.date) : '',
          entry.text,
          entry.amount,
          entry.receipt ? 'ja' : 'nein',
        ]),
    ),
  ];
  if (counted.length > 0) {
    sheets.push(
      sheet(
        'Kassensturz',
        [
          'Tag',
          'Anfangsbestand',
          'Verkäufe',
          'Spende',
          'Entnahmen',
          'Soll',
          'Gezählt',
          'Differenz',
        ],
        [12, 16, 12, 12, 12, 12, 12, 12],
        ['text', 'euro', 'euro', 'euro', 'euro', 'euro', 'euro', 'euro'],
        counted.map((day) => {
          const row = input.sturz[day];
          return [
            DAY_NAME[day],
            row.start,
            row.sales,
            row.donation,
            row.withdrawn,
            row.expected,
            row.done ? row.counted : 'nicht gezählt',
            row.done ? row.difference : null,
          ];
        }),
      ),
    );
  }
  return {
    title: 'Abrechnung Weihnachtsmarkt',
    subtitle: dates(input.saturday),
    sheets,
  };
}

/** The shopping list: what is needed, what is in stock, what is missing and what it costs. */
export function shoppingBook(items: readonly StockItem[]): XlsxBook {
  const rows = items.filter(onShoppingList).map((item) => {
    const buy = buyOf(item);
    const missing = buy.done
      ? 'gekauft'
      : buy.missing > 0
        ? quantity(buy.missing, item.unit)
        : 'ok';
    const packs =
      buy.shownPacks > 0
        ? item.pack > 0
          ? `${numberText(buy.shownPacks)} × ${quantity(item.pack, item.unit)}`
          : quantity(buy.shownPacks, item.unit)
        : '';
    return [
      item.name,
      item.category,
      quantity(item.need, item.unit),
      quantity(item.stock, item.unit),
      missing,
      packs,
      item.price,
      item.store,
      buy.total,
    ];
  });
  return {
    title: 'Einkaufsliste Weihnachtsmarkt',
    subtitle: 'Bedarf, Lager und Preise',
    sheets: [
      sheet(
        'Einkaufsliste',
        [
          'Artikel',
          'Kategorie',
          'Bedarf',
          'Lager',
          'Fehlt',
          'Packungen',
          'Preis je Packung',
          'Laden',
          'Gesamt',
        ],
        [26, 14, 12, 12, 14, 18, 18, 14, 12],
        ['text', 'text', 'center', 'center', 'center', 'center', 'euro', 'text', 'euro'],
        rows,
      ),
    ],
  };
}

export function marketFileName(kind: string, year: string): string {
  return `${kind}-Weihnachtsmarkt-${year}.xlsx`;
}
