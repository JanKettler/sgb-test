import { GroupId } from '../training/training.models';

export type Stroke = 'F' | 'R' | 'B' | 'S' | 'L';
export type Style = 'GL' | 'BE' | 'AR' | 'ST';
export type Sex = 'M' | 'W' | 'X';

export const STROKES: readonly { key: Stroke; label: string; short: string }[] = [
  { key: 'F', label: 'Freistil', short: 'K' },
  { key: 'R', label: 'Rücken', short: 'R' },
  { key: 'B', label: 'Brust', short: 'B' },
  { key: 'S', label: 'Schmetterling', short: 'S' },
  { key: 'L', label: 'Lagen', short: 'L' },
];

export const STYLES: readonly { key: Style; label: string }[] = [
  { key: 'GL', label: 'Gesamtlage' },
  { key: 'BE', label: 'Beine' },
  { key: 'AR', label: 'Arme' },
  { key: 'ST', label: 'Start' },
];

export const TIMINGS: readonly { key: string; label: string }[] = [
  { key: 'HANDZEIT', label: 'Handzeit' },
  { key: 'AUTOMATISCH', label: 'Automatisch' },
  { key: 'HALBAUTOMATISCH', label: 'Halbautomatisch' },
];

/** One section ("Abschnitt") of a meet: a block of events with its own times. */
export interface CompSection {
  no: number;
  /** ISO date */
  date: string;
  /** HH:mm; for later sections the time after the previous section when `relative` is set. */
  entry: string;
  warmup: string;
  judges: string;
  start: string;
  relative: boolean;
}

export interface CompEvent {
  no: number;
  section: number;
  /** 1 for individual events, 4 for a 4x50 relay. */
  count: number;
  distance: number;
  stroke: Stroke;
  style: Style;
  sex: Sex;
  /** Free text: "2019 - 2025", "2019" or "offen". */
  birthYears: string;
  /** Entry fee in euro. */
  fee: number;
}

export interface BankData {
  holder: string;
  bank: string;
  iban: string;
  bic: string;
}

export interface Competition {
  id: string;
  title: string;
  place: string;
  /** Pool length in metres. */
  pool: number;
  timing: string;
  venueName: string;
  venueStreet: string;
  venueZip: string;
  venueCity: string;
  organiser: string;
  host: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  note: string;
  /** ISO date of the official deadline and its time (HH:mm). */
  deadline: string;
  deadlineTime: string;
  /** ISO date until which swimmers and parents may register; later changes go through the trainers. */
  internalDeadline: string;
  /** Registration is open for swimmers and parents. */
  open: boolean;
  /** Only these groups see the meet; empty means everybody. */
  groupIds: GroupId[];
  flatFee: number;
  perSwimmerFee: number;
  discount: number;
  bank: BankData;
  /** Entry file was sent to the host. */
  sent: boolean;
  sections: CompSection[];
  events: CompEvent[];
}

/** One start of one swimmer. `time` is the entry time as "mm:ss,hh", empty without one. */
export interface Entry {
  competitionId: string;
  personId: string;
  eventNo: number;
  time: string;
}

export interface Decline {
  competitionId: string;
  personId: string;
}

export function strokeName(event: Pick<CompEvent, 'stroke' | 'style'>): string {
  const stroke = STROKES.find((item) => item.key === event.stroke);
  if (!stroke) return event.stroke;
  if (event.style === 'BE') return `${stroke.short}-Beine`;
  if (event.style === 'AR') return `${stroke.short}-Arme`;
  return stroke.label;
}

/** "50m Freistil", "4x50m Freistil", "25m K-Beine". */
export function eventLabel(event: CompEvent): string {
  const relay = event.count > 1 ? `${event.count}x` : '';
  return `${relay}${event.distance}m ${strokeName(event)}`;
}

export function sexLabel(sex: Sex): string {
  return sex === 'M' ? 'männlich' : sex === 'W' ? 'weiblich' : 'mixed';
}

/** The first day of the meet. */
export function dateOf(competition: Competition): string {
  const dates = competition.sections.map((section) => section.date).filter(Boolean);
  return dates.length > 0 ? [...dates].sort()[0] : competition.deadline;
}

/** True when the birth year fits the event's "2019 - 2025", "2019" or "offen". */
export function yearFits(birthYears: string, year: number): boolean {
  const text = birthYears.trim().toLowerCase();
  if (!text || text === 'offen') return true;
  const years = text.match(/\d{4}/g)?.map(Number) ?? [];
  if (years.length === 0) return true;
  if (years.length === 1) return years[0] === year;
  return year >= Math.min(...years) && year <= Math.max(...years);
}

/** Entry time typed freely ("31,2", "1:05,85", "65,85") as "mm:ss,hh"; null if it makes no sense. */
export function normalizeTime(value: string): string | null {
  const text = value.trim().replace('.', ',').replaceAll(' ', '');
  if (!text) return '';
  const match = /^(?:(\d{1,2}):)?(\d{1,3})(?:,(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  let minutes = match[1] ? Number(match[1]) : 0;
  let seconds = Number(match[2]);
  if (!match[1] && seconds >= 60) {
    minutes = Math.floor(seconds / 60);
    seconds %= 60;
  }
  if (seconds >= 60 || minutes > 59) return null;
  const hundredths = match[3] === undefined ? '00' : match[3].padEnd(2, '0');
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${hundredths}`;
}

export function euro(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}
