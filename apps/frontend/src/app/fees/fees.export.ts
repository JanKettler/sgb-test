import { XlsxBook, fitWidths } from '../competition/xlsx';
import { fullDate } from '../training/training-dates';

/** One payment as it is written to Excel; the amount stays a number so that Excel can sum it. */
export interface PaymentLine {
  label: string;
  payer: string;
  fee: string;
  amount: number;
  /** "bezahlt am 01.11.2026" or "offen" */
  status: string;
  method: string;
  level: number;
  purpose: string;
}

export interface DunningLine {
  payer: string;
  person: string;
  open: number;
  fee: number;
  total: number;
  level: number;
}

export interface FeeTypeLine {
  name: string;
  rule: string;
  amount: number;
  payers: number;
}

const PAYMENT_HEAD = [
  'Person',
  'Zahler',
  'Beitragsart',
  'Betrag',
  'Status',
  'Zahlart',
  'Mahnstufe',
  'Verwendungszweck',
];
const DUNNING_HEAD = ['Zahler', 'Person', 'Offen', 'Gebühr', 'Gesamt', 'Stufe'];
const FEE_TYPE_HEAD = ['Beitragsart', 'Regel', 'Betrag', 'Zahler'];

/** All payments of the list, as shown: one row per payment. */
export function paymentsBook(lines: readonly PaymentLine[], today: string): XlsxBook {
  return {
    title: 'Beitragszahlungen',
    subtitle: `Stand ${fullDate(today)}, ${lines.length} Zahlungen`,
    sheets: [
      {
        name: 'Zahlungen',
        orientation: 'landscape',
        head: PAYMENT_HEAD,
        widths: fitWidths(PAYMENT_HEAD, [26, 26, 22, 12, 24, 14, 12, 46]),
        formats: ['text', 'text', 'text', 'euro', 'center', 'center', 'center', 'text'],
        rows: lines.map((line) => [
          line.label,
          line.payer,
          line.fee,
          line.amount,
          line.status,
          line.method,
          line.level,
          line.purpose,
        ]),
      },
    ],
  };
}

/** The reminders that are about to be sent: open amount, fee and the total per payer. */
export function dunningBook(lines: readonly DunningLine[], today: string): XlsxBook {
  return {
    title: 'Mahnungen',
    subtitle: `Stand ${fullDate(today)}, ${lines.length} Mahnungen`,
    sheets: [
      {
        name: 'Mahnungen',
        head: DUNNING_HEAD,
        widths: fitWidths(DUNNING_HEAD, [28, 28, 12, 12, 12, 10]),
        formats: ['text', 'text', 'euro', 'euro', 'euro', 'center'],
        rows: lines.map((line) => [
          line.payer,
          line.person,
          line.open,
          line.fee,
          line.total,
          line.level,
        ]),
      },
    ],
  };
}

/** The fee types with their rule, the yearly amount and how many people pay them. */
export function feeTypesBook(lines: readonly FeeTypeLine[], today: string): XlsxBook {
  return {
    title: 'Beitragsarten',
    subtitle: `Stand ${fullDate(today)}`,
    sheets: [
      {
        name: 'Beitragsarten',
        head: FEE_TYPE_HEAD,
        widths: fitWidths(FEE_TYPE_HEAD, [28, 40, 12, 10]),
        formats: ['text', 'text', 'euro', 'center'],
        rows: lines.map((line) => [line.name, line.rule, line.amount, line.payers]),
      },
    ],
  };
}
