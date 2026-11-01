import { WaSet } from './wa-points';

/** Which pool lengths count for the ranking: the better points of both, or only one. */
export type BahnChoice = 'best' | 'Lang' | 'Kurz';

/** One start of the club's swimmers as the evaluation needs it. */
export interface EvalStart {
  /** Event number. */
  e: number;
  /** Heat and lane. */
  l: number;
  b: number;
  /** "Lastname, Firstname". */
  n: string;
  /** "M", "W" or "" when unknown. */
  s: string;
  /** Year of birth, or "Staffel" for relay teams. */
  j: string;
}

export interface EvalResult {
  /** "mm:ss,hh" */
  t: string;
  place: number;
  /** "DQ", "nicht angetreten" ... */
  status: string;
}

/** A meet with everything the evaluation reads from it. */
export interface EvalMeet {
  id: string;
  title: string;
  place: string;
  /** ISO date of the first day. */
  date: string;
  /** Pool length in metres; 25 and 50 count, anything else is unknown. */
  pool: number;
  /** Event name by event number (the distance and stroke are read from it). */
  eventNames: Record<number, string>;
  /** ISO date of the section an event is swum in. */
  eventDates: Record<number, string>;
  starts: EvalStart[];
  /** Result per "event-heat-lane". */
  results: Record<string, EvalResult>;
  /** Places of the relay teams listed in the protocol. */
  relayPlaces: number[];
  /** Judges of the club per section. */
  judges: { name: string; section: number }[];
  /** Entry fees of the club at this meet, null when unknown. */
  fee: number | null;
}

export interface EvalMember {
  name: string;
  birthYear: number;
  /** "M", "W" or "X". */
  sex: string;
  /** ISO date of joining and of leaving. */
  entry: string;
  exit: string;
  groups: string[];
}

/** A group of birth years: "Jahrgang 2012" or "Jahrgang 2012–2013". */
export interface BandDef {
  label: string;
  /** [from, to] pairs of birth years; to = 9999 means "and younger". */
  ranges: [number, number][];
  /** "M" or "W" restricts the group to one sex, "" means both. */
  sex: '' | 'M' | 'W';
}

export interface EvalConfig {
  /** Age from which swimmers count as Masters. */
  masters: number;
  /** Groups with this many people or fewer are merged with a neighbouring group. */
  mergeMax: number;
  /** Own groups per year for women and men; empty means the default groups. */
  bandsW: Record<string, BandDef[]>;
  bandsM: Record<string, BandDef[]>;
}

/** The points list of WebClub ("Punktbeste Leistung nach World Aquatics") of one season and pool. */
export interface PointRow {
  name: string;
  jg: number;
  sex: string;
  p: Record<string, number>;
  ges: number;
}

export interface PointList {
  id: string;
  jahr: string;
  bahn: 'Lang' | 'Kurz';
  rows: PointRow[];
  stand: string;
  file: string;
}

export interface EvalInput {
  meets: EvalMeet[];
  members: EvalMember[];
  waSets: WaSet[];
  lists: PointList[];
  config: EvalConfig;
  clubName: string;
  /** ISO date of today. */
  today: string;
  /** Fee typed by hand per meet id. */
  fees: Record<string, number>;
  /** Judges that do not count in the statistic. */
  excluded: string[];
}

/** A result with points, as shown on the sheet of a swimmer. */
export interface SwimStart {
  /** ISO date */
  d: string;
  place: string;
  /** Pool length in metres, 0 when unknown. */
  b: number;
  /** Distance and stroke: "100F". */
  k: string;
  t: string;
  meetId: string;
  name: string;
  jg: number;
  sex: string;
  points: number | null;
}

/** A swimmer in the ranking with the best points per event. */
export interface Swimmer {
  name: string;
  jg: number;
  sex: string;
  /** Best points per event, over both pools and per pool kind. */
  p: Record<string, number>;
  l: Record<string, number>;
  k: Record<string, number>;
  /** Number of events counted, sum and average of the points. */
  n: number;
  ges: number;
  avg: number;
}

export interface BandGroup {
  label: string;
  ranges: [number, number][];
  members: Swimmer[];
  junior: boolean;
  merged: boolean;
}

export interface EventRow {
  id: string;
  d: string;
  title: string;
  place: string;
  /** "Kurz", "Lang" or "–". */
  pool: string;
  poolMeters: number;
  swimmers: number;
  singles: number;
  relays: number;
  fee: number | null;
  /** The fee was typed by hand. */
  manual: boolean;
}

export interface JudgeRow {
  name: string;
  excluded: boolean;
  club: string;
  meets: number;
  sections: number;
  events: { d: string; title: string; sections: number[] }[];
}

export interface Stat {
  events: EventRow[];
  total: { swimmers: number; singles: number; relays: number };
  judges: JudgeRow[];
  /** Places 1, 2, 3 and others for single starts and relays. */
  places: { singles: number[]; relays: number[] };
  count: number;
}

/** A cell of a table in the evaluation: shown on screen and written to the Excel file. */
export interface Cell {
  v: string | number;
  /** Alignment of the text: left or right; centred without. */
  align?: 'l' | 'r';
  bold?: boolean;
  /** Header cell. */
  head?: boolean;
  span?: number;
  /** Only on screen. */
  screen?: boolean;
  /** A button on screen instead of text. */
  action?: CellAction;
}

export type CellAction =
  | { type: 'fee'; id: string; manual: boolean; value: number | null }
  | { type: 'judge'; name: string; excluded: boolean };

export interface Row {
  cells: Cell[];
  /** `total` gets a heavy top line, `group` is the bold line of an event on a sheet. */
  kind?: 'total' | 'group';
  /** Only on screen. */
  screen?: boolean;
  /** Shown dimmed (a judge that does not count). */
  dim?: boolean;
}

/** The look of a table: width and alignment follow the Intranet. */
export type TableStyle = 'rank' | 'events' | 'judges' | 'places' | 'info' | 'medals' | 'sheet';

export type Block =
  | { type: 'title'; text: string; level: 1 | 2 }
  | { type: 'table'; style: TableStyle; rows: Row[] }
  | {
      type: 'sum';
      label: string;
      value: string | number;
      labelBold: boolean;
      valueBold: boolean;
      small?: boolean;
    }
  | { type: 'columns'; columns: Block[][] }
  | { type: 'sheet'; blocks: Block[] }
  | { type: 'note'; text: string };

export interface ReportPart {
  name: string;
  blocks: Block[];
}
