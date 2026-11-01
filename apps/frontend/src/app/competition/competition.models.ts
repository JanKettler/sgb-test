import { GroupId } from '../training/training.models';

export type Stroke = 'F' | 'R' | 'B' | 'S' | 'L' | 'X';
export type Style = 'GL' | 'BE' | 'AR' | 'ST';
export type Sex = 'M' | 'W' | 'X';

export const STROKES: readonly { key: Stroke; label: string; short: string }[] = [
  { key: 'F', label: 'Freistil', short: 'K' },
  { key: 'R', label: 'Rücken', short: 'R' },
  { key: 'B', label: 'Brust', short: 'B' },
  { key: 'S', label: 'Schmetterling', short: 'S' },
  { key: 'L', label: 'Lagen', short: 'L' },
  { key: 'X', label: 'Sonderstrecke', short: 'X' },
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
  /** Free text: "2019 - 2025", "2019", "bis 2006" or "offen". */
  birthYears: string;
  /** Entry fee in euro. */
  fee: number;
  /** Name from the announcement for special events (stroke "X"), e.g. "4x50m T-Shirt-Staffel". */
  name?: string;
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
  /** Persons of the club who act as judges, per section number. */
  officials: Record<number, string[]>;
  /** Persons of the club who coach, per section number. */
  coaches: Record<number, string[]>;
  plan: Plan;
  schedule: Schedule;
}

/** One start of one swimmer. `time` is the entry time as "mm:ss,hh", empty without one. */
export interface Entry {
  competitionId: string;
  personId: string;
  eventNo: number;
  time: string;
}

/** One start in the Meldeergebnis: event, heat, lane, time of day and swimmer. */
export interface RunStart {
  e: number;
  l: number;
  lt: number;
  /** Time of day, "10:35". */
  t: string;
  b: number;
  /** "Lastname, Firstname" as printed in the file. */
  n: string;
  s: string;
  j: string;
  /** Entry time as "mm:ss,hh". */
  m: string;
}

/** A slot in the host's judge panel that the club has to fill. */
export interface Duty {
  a: number;
  g: string;
  pos: string;
  name: string;
}

/** Result of one start; `status` is "DQ", "nicht angetreten" or "abgemeldet". */
export interface RunResult {
  t: string;
  sp: string[];
  status: string;
  place: number;
  ageGroup: string;
}

/** What the Meldeergebnis and the result list tell about the club at the meet. */
export interface Schedule {
  starts: RunStart[];
  duties: Duty[];
  eventNames: Record<number, string>;
  /** Result per "event-heat-lane". */
  results: Record<string, RunResult>;
  stand: string;
  relayResults: { e: number; place: number; time: string; status: string }[];
}

export type FeeStatus = '' | 'mail' | 'paid';
export type Participation = '' | 'yes' | 'no';

/** Checklist of the meet: ticked steps with who and when, plus the open questions. */
export interface Plan {
  done: Record<string, { by: string; at: string }>;
  fee: FeeStatus;
  participation: Participation;
  /** Number of judges the club sends, per section. */
  judges: Record<number, number | null>;
}

export const PHASES: readonly { id: string; label: string; items: readonly [string, string][] }[] =
  [
    {
      id: 'plan',
      label: 'Planung',
      items: [
        ['created', 'Wettkampf im Portal angelegt'],
        ['judgesAsked', 'Kampfrichter abgefragt'],
        ['announced', 'Bekanntgabe in WhatsApp'],
      ],
    },
    {
      id: 'entry',
      label: 'Meldung',
      items: [
        ['licences', 'DSV-Lizenzen geprüft'],
        ['checked', 'Meldungen geprüft'],
        ['sent', 'Meldungen versendet'],
        ['confirmed', 'Meldebestätigung erhalten'],
      ],
    },
    {
      id: 'after',
      label: 'Nach dem Meldeergebnis',
      items: [
        ['group', 'WhatsApp-Gruppe angelegt'],
        ['scheduleShared', 'Meldeergebnis in WhatsApp'],
      ],
    },
    {
      id: 'after-meet',
      label: 'Nachbereitung',
      items: [
        ['certPrinted', 'Urkunden gedruckt'],
        ['certGiven', 'Urkunden verteilt'],
        ['article', 'Artikel für die Homepage'],
      ],
    },
  ];

/** A relay team: four swimmers, one entry time and the age class (birth year) of the team. */
export interface RelayEntry {
  competitionId: string;
  eventNo: number;
  /** Number of the team in the club: 1 = "1. Mannschaft". */
  team: number;
  year: number;
  time: string;
  memberIds: string[];
}

export interface Decline {
  competitionId: string;
  personId: string;
}

export function strokeName(event: Pick<CompEvent, 'stroke' | 'style' | 'name'>): string {
  if (event.stroke === 'X') return event.name || 'Sonderstrecke';
  const stroke = STROKES.find((item) => item.key === event.stroke);
  if (!stroke) return event.stroke;
  if (event.style === 'BE') return `${stroke.short}-Beine`;
  if (event.style === 'AR') return `${stroke.short}-Arme`;
  return stroke.label;
}

/** "50m Freistil", "4x50m Freistil", "25m K-Beine". */
export function eventLabel(event: CompEvent): string {
  if (event.stroke === 'X' && event.name) return event.name;
  const relay = event.count > 1 ? `${event.count}x` : '';
  return `${relay}${event.distance}m ${strokeName(event)}`;
}

export function sexLabel(sex: Sex): string {
  return sex === 'M' ? 'männlich' : sex === 'W' ? 'weiblich' : 'mixed';
}

/** Number of assignments in a per-section list: a person in two sections counts twice. */
export function staffCount(lists: Record<number, string[]>): number {
  return Object.values(lists).reduce((sum, ids) => sum + ids.length, 0);
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
  const until = /^bis\s*(\d{4})$/.exec(text);
  if (until) return year <= Number(until[1]);
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

/** An entry time of zero: "no time known". */
export const NO_TIME = '00:00,00';

/**
 * Digits typed into a time field become "mm:ss,hh" from the right, like on a calculator:
 * "13852" gives "01:38,52" and "000000" gives "00:00,00".
 */
export function maskTime(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(-6).padStart(6, '0');
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)},${digits.slice(4)}`;
}

/** True for "" and for "mm:ss,hh" with fewer than 60 seconds. */
export function isValidTime(time: string): boolean {
  if (!time) return true;
  const match = /^(\d{2}):(\d{2}),(\d{2})$/.exec(time);
  return !!match && Number(match[2]) < 60;
}

/** Milliseconds of "mm:ss,hh", "m:ss,hh" or "ss,hh"; null when it is no time. */
export function timeMs(time: string): number | null {
  const match = /^(?:(\d{1,2}):)?(\d{1,2}),(\d{2})$/.exec(time.trim());
  if (!match) return null;
  return (Number(match[1] ?? 0) * 60 + Number(match[2])) * 1000 + Number(match[3]) * 10;
}

/** "01:57,66" is shown as "1:57,66" and "00:39,80" as "39,80", like in the result lists. */
export function showTime(time: string): string {
  const ms = timeMs(time);
  if (ms === null || ms === 0) return '';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const hundredths = Math.round((ms % 1000) / 10);
  const pad = (value: number) => String(value).padStart(2, '0');
  return minutes > 0
    ? `${minutes}:${pad(seconds)},${pad(hundredths)}`
    : `${seconds},${pad(hundredths)}`;
}

export function euro(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

export function emptyPlan(): Plan {
  return { done: {}, fee: '', participation: '', judges: {} };
}

export function emptySchedule(): Schedule {
  return { starts: [], duties: [], eventNames: {}, results: {}, stand: '', relayResults: [] };
}

/** Key of a start in `Schedule.results`. */
export function startKey(start: Pick<RunStart, 'e' | 'l' | 'b'>): string {
  return `${start.e}-${start.l}-${start.b}`;
}

/** "Mustermann, Max" and "Max Mustermann" compare equal. */
export function sameName(a: string, b: string): boolean {
  const norm = (text: string) =>
    text.toLowerCase().replaceAll(',', ' ').split(/\s+/).filter(Boolean).sort().join(' ');
  return norm(a) === norm(b);
}
