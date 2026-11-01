import { timeMs } from '../competition.models';
import {
  BahnChoice,
  BandDef,
  BandGroup,
  EvalConfig,
  EvalInput,
  EvalMeet,
  EventRow,
  JudgeRow,
  Stat,
  SwimStart,
  Swimmer,
} from './evaluation.model';
import { PoolKind, waPoints, pickWaSet } from './wa-points';

const STROKE_WORD: Record<string, string> = {
  schmetterling: 'S',
  rücken: 'R',
  ruecken: 'R',
  brust: 'B',
  freistil: 'F',
  lagen: 'L',
};
const STROKE_NAME: Record<string, string> = {
  S: 'Schmetterling',
  R: 'Rücken',
  B: 'Brust',
  F: 'Freistil',
  L: 'Lagen',
};
const STROKE_ORDER = ['S', 'R', 'B', 'F', 'L'];

/** Distance and stroke from an event name: "100m Brust weiblich" gives "100B"; relays give "". */
export function streckeOf(name: string): string {
  const text = name
    .replace(/^\s*(Wettkampf|WK)\s*\d+\s*[-–:.]?\s*/i, '')
    .replace(/^\s*\d+\s*[.:]\s+(?=\d)/, '');
  if (/\d\s*x\s*\d/i.test(text)) return '';
  // Leg and arm drills get no points.
  if (/\b(beine|arme)\b/i.test(text)) return '';
  const match =
    /^\s*(\d{2,4})\s*m?\s*[-–]?\s*(Schmetterling|Delphin|R[üu]e?cken|Brust|Freistil|Kraul|Lagen|[SRBFL])\b/i.exec(
      text,
    );
  if (!match) return '';
  const word = match[2].toLowerCase();
  const code =
    STROKE_WORD[word] ??
    (word.startsWith('delphin')
      ? 'S'
      : word.startsWith('kraul')
        ? 'F'
        : word.startsWith('r')
          ? 'R'
          : word.length === 1
            ? word.toUpperCase()
            : '');
  return code ? match[1] + code : '';
}

/** "100m Freistil" for "100F". */
export function strokeLabel(code: string): string {
  const match = /^(\d+)([SRBFL])$/.exec(code);
  return match ? `${match[1]}m ${STROKE_NAME[match[2]]}` : code;
}

/** Sort key of an event code: strokes in the order S, R, B, F, L, then by distance. */
export function strokeSort(code: string): number {
  const match = /^(\d+)([SRBFL])$/.exec(code);
  return match ? STROKE_ORDER.indexOf(match[2]) * 10000 + Number(match[1]) : 0;
}

/** "Anna Muster" for "Muster, Anna". */
export function flipName(name: string): string {
  return name.replace(/^([^,]+),\s*(.+)$/, '$2 $1').trim();
}

/** Lower-case name used to recognise the same swimmer at different meets. */
export function nameKey(name: string): string {
  return flipName(name).toLowerCase();
}

/** "30.05.26" for an ISO date. */
export function shortDate(iso: string): string {
  return iso.length >= 10 ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}` : iso;
}

/** "30.05.2026" for an ISO date. */
export function longDate(iso: string): string {
  return iso.length >= 10 ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : iso;
}

/** Difference to the best time on the sheet of a swimmer: "+00:01,23". */
export function sheetDiff(ms: number): string {
  const abs = Math.abs(ms);
  let seconds = Math.floor(abs / 1000);
  let hundredths = Math.round((abs % 1000) / 10);
  if (hundredths === 100) {
    seconds++;
    hundredths = 0;
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${ms < 0 ? '-' : '+'}${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)},${pad(hundredths)}`;
}

/** "12,50 €", or "–" without an amount. */
export function money(value: number | null): string {
  return value === null || Number.isNaN(value) ? '–' : `${value.toFixed(2).replace('.', ',')} €`;
}

/** Medals per group of Jugend: up to 3 people only gold, 4 to 5 also silver, from 6 also bronze. */
export function medalsFor(count: number): number {
  return count <= 0 ? 0 : count <= 3 ? 1 : count <= 5 ? 2 : 3;
}

export function defaultConfig(): EvalConfig {
  return { masters: 25, mergeMax: 1, bandsW: {}, bandsM: {} };
}

/** The standard groups: Junioren, every year of birth on its own, the youngest together. */
export function defaultBands(year: string): BandDef[] {
  const y = Number(year);
  const bands: BandDef[] = [
    { label: `Junior (Jg. ${y - 18} und älter)`, ranges: [[0, y - 18]], sex: '' },
  ];
  for (let q = y - 17; q <= y - 8; q++) {
    bands.push({ label: `Jahrgang ${q}`, ranges: [[q, q]], sex: '' });
  }
  bands.push({ label: `Jahrgang ${y - 7} und jünger`, ranges: [[y - 7, 9999]], sex: '' });
  return bands.sort((a, b) => a.ranges[0][0] - b.ranges[0][0]);
}

/** Name of merged groups: "Jahrgang 2012–2013" or "Jahrgang 2017 und jünger". */
export function mergedLabel(ranges: readonly [number, number][]): string {
  let low = 99999;
  let high = 0;
  for (const range of ranges) {
    low = Math.min(low, range[0] || 0);
    high = Math.max(high, range[1]);
  }
  if (high >= 9999) return `Jahrgang ${low} und jünger`;
  return low === high ? `Jahrgang ${low}` : `Jahrgang ${low}–${high}`;
}

function byPoints(a: Swimmer, b: Swimmer): number {
  return b.ges - a.ges || a.name.localeCompare(b.name, 'de');
}

function isMasterBand(label: string): boolean {
  return /^masters/i.test(label);
}

function isJuniorBand(band: BandDef): boolean {
  return /^junior/i.test(band.label) || band.ranges[0]?.[0] === 0;
}

/** A hint about base times of an older year, or null while the table of this year exists. */
export interface WaExpired {
  last: number;
  current: number;
}

export interface Diagnosis {
  title: string;
  date: string;
  text: string;
}

export interface MemberStats {
  joined: number;
  left: number;
  reference: number;
  total: number;
  women: number;
  men: number;
  other: number;
  groups: [string, number][];
  ages: [string, number][];
  jubilees: { years: number; names: string[] }[];
}

export interface HonourGroup {
  title: string;
  merged: boolean;
  members: Swimmer[];
  medals: number;
}

export interface Honours {
  cups: { title: string; swimmer: Swimmer }[];
  groups: HonourGroup[];
  totals: number[];
}

const AGE_BANDS: [string, number, number][] = [
  ['0-6 Jahre', 0, 6],
  ['7-14 Jahre', 7, 14],
  ['15-18 Jahre', 15, 18],
  ['19-26 Jahre', 19, 26],
  ['27-40 Jahre', 27, 40],
  ['über 40 Jahre', 41, 200],
];

const JUBILEE_YEARS = [10, 25, 40, 50];

/** All calculations of the yearly evaluation (ranking, statistic, honours) on one set of data. */
export class Evaluation {
  private readonly startCache = new Map<string, Record<string, SwimStart[]>>();

  constructor(readonly input: EvalInput) {}

  private cancelled(meet: EvalMeet): boolean {
    return /abgesagt/i.test(meet.title);
  }

  private hasResults(meet: EvalMeet): boolean {
    return Object.keys(meet.results).length > 0;
  }

  /** Years with results or points lists, newest first. */
  years(): string[] {
    const years = new Set<string>();
    for (const list of this.input.lists) years.add(list.jahr);
    for (const meet of this.input.meets) {
      if (meet.date && this.hasResults(meet) && !this.cancelled(meet)) {
        years.add(meet.date.slice(0, 4));
      }
    }
    return [...years].sort().reverse();
  }

  /** Meets of a year that were not cancelled, oldest first. */
  meetsOf(year: string): EvalMeet[] {
    return this.input.meets
      .filter((meet) => meet.date.slice(0, 4) === year && !this.cancelled(meet))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Meets of a year with at least one result. */
  meetsWithResults(year: string): EvalMeet[] {
    return this.meetsOf(year).filter((meet) => this.hasResults(meet));
  }

  poolOf(meet: EvalMeet): number {
    return meet.pool === 25 || meet.pool === 50 ? meet.pool : 0;
  }

  masters(): number {
    return this.input.config.masters > 0 ? this.input.config.masters : 25;
  }

  mergeMax(): number {
    const value = this.input.config.mergeMax;
    return Number.isFinite(value) ? Math.max(0, Math.min(9, value)) : 1;
  }

  age(swimmer: Pick<Swimmer, 'jg'>, year: string): number {
    return Number(year) - swimmer.jg;
  }

  isYouth(year: string): (swimmer: Swimmer) => boolean {
    return (swimmer) => this.age(swimmer, year) < this.masters();
  }

  /** Every timed single start of the club's swimmers in a year, by swimmer, oldest first. */
  starts(year: string): Record<string, SwimStart[]> {
    const cached = this.startCache.get(year);
    if (cached) return cached;
    const by: Record<string, SwimStart[]> = {};
    for (const meet of this.meetsOf(year)) {
      const pool = this.poolOf(meet);
      const kind: PoolKind | '' = pool === 25 ? 'Kurz' : pool === 50 ? 'Lang' : '';
      for (const start of meet.starts) {
        if (start.j === 'Staffel') continue;
        const result = meet.results[`${start.e}-${start.l}-${start.b}`];
        if (!result?.t) continue;
        const code = streckeOf(meet.eventNames[start.e] ?? '');
        if (!code) continue;
        const key = nameKey(start.n);
        const date = meet.eventDates[start.e] || meet.date;
        const ms = timeMs(result.t);
        const points =
          ms === null ? null : waPoints(this.input.waSets, start.s, kind, code, date, ms);
        const list = by[key] ?? (by[key] = []);
        if (list.some((x) => x.d === date && x.k === code && x.b === pool && x.t === result.t)) {
          continue;
        }
        list.push({
          d: date,
          place: meet.place || meet.title,
          b: pool,
          k: code,
          t: result.t,
          meetId: meet.id,
          name: flipName(start.n),
          jg: Number(start.j) || 0,
          sex: start.s,
          points,
        });
      }
    }
    for (const list of Object.values(by)) list.sort((a, b) => a.d.localeCompare(b.d));
    this.startCache.set(year, by);
    return by;
  }

  /** The swimmers of a year ranked by the sum of their best points per event. */
  ranking(year: string, bahn: BahnChoice): Swimmer[] {
    const by = new Map<string, Swimmer>();
    const fresh = (name: string, jg: number, sex: string): Swimmer => ({
      name,
      jg,
      sex,
      p: {},
      l: {},
      k: {},
      n: 0,
      ges: 0,
      avg: 0,
    });
    for (const course of ['Lang', 'Kurz'] as const) {
      if (bahn !== 'best' && bahn !== course) continue;
      const list = this.input.lists.find((item) => item.jahr === year && item.bahn === course);
      if (!list) continue;
      for (const row of list.rows) {
        const key = row.name.toLowerCase();
        const swimmer = by.get(key) ?? fresh(row.name, row.jg, row.sex);
        by.set(key, swimmer);
        for (const event of Object.keys(row.p)) {
          (course === 'Lang' ? swimmer.l : swimmer.k)[event] = row.p[event];
          if (swimmer.p[event] === undefined || swimmer.p[event] < row.p[event]) {
            swimmer.p[event] = row.p[event];
          }
        }
      }
    }
    const starts = this.starts(year);
    for (const key of Object.keys(starts)) {
      for (const start of starts[key]) {
        if (!start.points || start.points <= 0) continue;
        const course = start.b === 50 ? 'Lang' : start.b === 25 ? 'Kurz' : '';
        if (!course || (bahn !== 'best' && bahn !== course)) continue;
        const swimmer = by.get(key) ?? fresh(start.name, start.jg, start.sex);
        by.set(key, swimmer);
        const target = course === 'Lang' ? swimmer.l : swimmer.k;
        if (target[start.k] === undefined || target[start.k] < start.points) {
          target[start.k] = start.points;
        }
        if (swimmer.p[start.k] === undefined || swimmer.p[start.k] < start.points) {
          swimmer.p[start.k] = start.points;
        }
      }
    }
    const list = [...by.values()].map((swimmer) => {
      swimmer.n = Object.keys(swimmer.p).length;
      swimmer.ges = Object.values(swimmer.p).reduce((sum, value) => sum + value, 0);
      swimmer.avg = swimmer.n ? Math.round(swimmer.ges / swimmer.n) : 0;
      return swimmer;
    });
    return list.sort(byPoints);
  }

  /** Groups of birth years for one sex: the own ones of the year or the standard groups. */
  bandList(year: string, sex: 'W' | 'M'): BandDef[] {
    const own = (sex === 'W' ? this.input.config.bandsW : this.input.config.bandsM)[year];
    return own && own.length ? own : defaultBands(year);
  }

  /** Groups of one sex with the youth swimmers in them; groups of few people are merged. */
  genderGroups(year: string, youth: Swimmer[], sex: 'W' | 'M'): BandGroup[] {
    const groups: (BandGroup & { stuck?: boolean })[] = [];
    for (const band of this.bandList(year, sex)) {
      if (band.sex && band.sex !== sex) continue;
      if (isMasterBand(band.label)) continue;
      const members = youth.filter(
        (swimmer) =>
          (!band.sex || swimmer.sex === band.sex) &&
          band.ranges.some((range) => swimmer.jg >= range[0] && swimmer.jg <= range[1]),
      );
      groups.push({
        label: band.label,
        ranges: band.ranges.map((range) => [...range] as [number, number]),
        members,
        junior: isJuniorBand(band),
        merged: false,
      });
    }
    let guard = 0;
    while (guard++ < 50) {
      const candidates: number[] = [];
      groups.forEach((group, index) => {
        if (
          !group.junior &&
          group.members.length >= 1 &&
          group.members.length <= this.mergeMax() &&
          !group.stuck
        ) {
          candidates.push(index);
        }
      });
      if (!candidates.length) break;
      candidates.sort((a, b) => groups[a].members.length - groups[b].members.length || a - b);
      const at = candidates[0];
      const group = groups[at];
      let before = -1;
      let after = -1;
      for (let k = at - 1; k >= 0; k--) {
        if (!groups[k].junior && groups[k].members.length) {
          before = k;
          break;
        }
      }
      for (let k = at + 1; k < groups.length; k++) {
        if (!groups[k].junior && groups[k].members.length) {
          after = k;
          break;
        }
      }
      if (before < 0 && after < 0) {
        group.stuck = true;
        continue;
      }
      const target =
        before < 0
          ? after
          : after < 0
            ? before
            : groups[after].members.length < groups[before].members.length
              ? after
              : before;
      const into = groups[target];
      into.members = into.members.concat(group.members).sort(byPoints);
      into.ranges = into.ranges.concat(group.ranges);
      into.label = mergedLabel(into.ranges);
      into.merged = true;
      groups.splice(at, 1);
    }
    return groups
      .filter((group) => group.members.length)
      .map(({ label, ranges, members, junior, merged }) => ({
        label,
        ranges,
        members,
        junior,
        merged,
      }));
  }

  /** Cups for the best of each sex (all and youth) and the medals per group. */
  honours(year: string, list: Swimmer[]): Honours {
    const out: Honours = { cups: [], groups: [], totals: [0, 0, 0] };
    const youth = this.isYouth(year);
    for (const [word, sex] of [
      ['weiblich', 'W'],
      ['männlich', 'M'],
    ] as const) {
      const all = list.filter((swimmer) => swimmer.sex === sex);
      const young = all.filter(youth);
      if (all.length) out.cups.push({ title: `Gesamt ${word}`, swimmer: all[0] });
      if (young.length) out.cups.push({ title: `Jugend ${word}`, swimmer: young[0] });
      for (const group of this.genderGroups(year, young, sex)) {
        const medals = medalsFor(group.members.length);
        for (let i = 0; i < medals; i++) out.totals[i]++;
        out.groups.push({
          title: `${group.label} ${word}`,
          merged: group.merged,
          members: group.members,
          medals,
        });
      }
    }
    return out;
  }

  /** Events, judges and places of a year, from the meets with results. */
  stat(year: string): Stat {
    const meets = this.meetsWithResults(year);
    const places = { singles: [0, 0, 0, 0], relays: [0, 0, 0, 0] };
    const total = { swimmers: 0, singles: 0, relays: 0 };
    const events: EventRow[] = [];
    const judges = new Map<
      string,
      {
        meets: Set<string>;
        sections: Set<string>;
        events: Map<string, { d: string; title: string; sections: number[] }>;
      }
    >();
    for (const meet of meets) {
      const swimmers = new Set<string>();
      let singles = 0;
      let relays = 0;
      for (const start of meet.starts) {
        const result = meet.results[`${start.e}-${start.l}-${start.b}`];
        if (!result?.t) continue;
        const relay = start.j === 'Staffel';
        if (relay) relays++;
        else {
          singles++;
          swimmers.add(nameKey(start.n));
        }
        const place = result.place || 0;
        (relay ? places.relays : places.singles)[place > 0 && place <= 3 ? place - 1 : 3]++;
      }
      const protocol = meet.relayPlaces;
      if (!relays && protocol.length) {
        for (const place of protocol) places.relays[place > 0 && place <= 3 ? place - 1 : 3]++;
      } else if (relays < protocol.length) {
        places.relays[3] += protocol.length - relays;
      }
      relays = Math.max(relays, protocol.length);
      const pool = this.poolOf(meet);
      const manual = this.input.fees[meet.id] !== undefined;
      events.push({
        id: meet.id,
        d: meet.date,
        title: meet.title,
        place: meet.place,
        pool: pool === 25 ? 'Kurz' : pool === 50 ? 'Lang' : '–',
        poolMeters: pool,
        swimmers: swimmers.size,
        singles,
        relays,
        fee: manual ? this.input.fees[meet.id] : meet.fee,
        manual,
      });
      total.swimmers += swimmers.size;
      total.singles += singles;
      total.relays += relays;
      for (const judge of meet.judges) {
        const name = judge.name.trim();
        if (!name || /^N\s?N$/i.test(name)) continue;
        const entry = judges.get(name) ?? {
          meets: new Set<string>(),
          sections: new Set<string>(),
          events: new Map<string, { d: string; title: string; sections: number[] }>(),
        };
        judges.set(name, entry);
        entry.meets.add(meet.id);
        entry.sections.add(`${meet.id}|${judge.section}`);
        const item = entry.events.get(meet.id) ?? { d: meet.date, title: meet.title, sections: [] };
        entry.events.set(meet.id, item);
        if (judge.section && !item.sections.includes(judge.section)) {
          item.sections.push(judge.section);
        }
      }
    }
    const rows: JudgeRow[] = [...judges.entries()]
      .map(([name, entry]) => ({
        name,
        excluded: this.input.excluded.includes(name),
        club: this.input.clubName,
        meets: entry.meets.size,
        sections: entry.sections.size,
        events: [...entry.events.values()]
          .map((item) => ({ ...item, sections: [...item.sections].sort((a, b) => a - b) }))
          .sort((a, b) => a.d.localeCompare(b.d)),
      }))
      .sort((a, b) => b.sections - a.sections || a.name.localeCompare(b.name, 'de'));
    return { events, total, judges: rows, places, count: meets.length };
  }

  /** The reasons a start of a swimmer does not reach the evaluation. */
  private startReason(
    meet: EvalMeet,
    start: EvalMeet['starts'][number],
  ): '' | 'noRes' | 'dns' | 'noEv' {
    const result = meet.results[`${start.e}-${start.l}-${start.b}`];
    if (!result?.t) return result?.status ? 'dns' : 'noRes';
    if (start.j !== 'Staffel' && !streckeOf(meet.eventNames[start.e] ?? '')) return 'noEv';
    return '';
  }

  /** What is missing for a complete evaluation of a year. */
  missing(year: string): { bold: string; text: string }[] {
    const lines: { bold: string; text: string }[] = [];
    const today = this.input.today;
    const without = this.meetsOf(year).filter(
      (meet) => meet.date <= today && !this.hasResults(meet),
    );
    if (without.length) {
      lines.push({
        bold: 'Ergebnisse fehlen bei:',
        text: `${without.map((meet) => `${meet.title || 'Wettkampf'} (${longDate(meet.date)})`).join('; ')}. Im Wettkampf unter „Ergebnisse“ einlesen.`,
      });
    }
    const noFee = this.meetsWithResults(year).filter(
      (meet) => meet.fee === null && this.input.fees[meet.id] === undefined,
    );
    if (noFee.length) {
      lines.push({
        bold: 'Meldegeld fehlt bei:',
        text: `${noFee.map((meet) => meet.title || 'Wettkampf').join('; ')} (Betrag in der Tabelle unter „Ändern“ eintragen).`,
      });
    }
    for (const meet of this.meetsOf(year)) {
      if (!meet.starts.length || meet.date > today) continue;
      const counts = { n: 0, ok: 0, noRes: 0, dns: 0, noEv: 0 };
      const events = new Set<number>();
      let sample = '';
      for (const start of meet.starts) {
        if (start.j === 'Staffel') continue;
        counts.n++;
        const reason = this.startReason(meet, start);
        if (!reason) counts.ok++;
        else {
          counts[reason]++;
          if (reason === 'noEv') {
            events.add(start.e);
            if (!sample) sample = meet.eventNames[start.e] ?? '';
          }
        }
      }
      const parts: string[] = [];
      const pool = this.poolOf(meet);
      if (
        pool &&
        this.hasResults(meet) &&
        !pickWaSet(this.input.waSets, pool === 25 ? 'Kurz' : 'Lang', meet.date)
      ) {
        parts.push(
          `keine World-Aquatics-Tabelle für ${pool === 25 ? 'Kurzbahn' : 'Langbahn'} vorhanden, deshalb keine Punkte (unter „Hochladen“ einlesen)`,
        );
      }
      if (counts.noRes) parts.push(`${counts.noRes} von ${counts.n} Starts ohne Ergebnis`);
      if (counts.noEv) {
        parts.push(
          `${counts.noEv} Starts mit nicht erkannter Strecke (Wettkampf-Nr. ${[...events].join(', ')}; ${sample ? `Name im Wettkampf zum Beispiel „${sample}“` : 'im Wettkampf sind keine Streckennamen hinterlegt, bitte das Meldeergebnis neu einlesen'})`,
        );
      }
      if (parts.length) {
        lines.push({
          bold: meet.title || 'Wettkampf',
          text: `(${longDate(meet.date)}): ${parts.join(', ')}. Diese Zeiten fehlen in der Auswertung.`,
        });
      }
    }
    return lines;
  }

  /** Per swimmer: which starts do not reach the sheet? */
  swimmerGaps(year: string, name: string): string[] {
    const key = nameKey(name);
    const lines: string[] = [];
    for (const meet of this.meetsOf(year)) {
      if (meet.date > this.input.today) continue;
      const counts = { noRes: 0, noEv: 0, dns: 0 };
      let total = 0;
      for (const start of meet.starts) {
        if (start.j === 'Staffel' || nameKey(start.n) !== key) continue;
        total++;
        const reason = this.startReason(meet, start);
        if (reason) counts[reason]++;
      }
      const parts: string[] = [];
      if (counts.noRes) parts.push(`${counts.noRes} ohne Ergebnis`);
      if (counts.noEv) parts.push(`${counts.noEv} mit nicht erkannter Strecke`);
      if (counts.dns) parts.push(`${counts.dns} nicht angetreten`);
      if (parts.length) {
        lines.push(
          `${meet.title || 'Wettkampf'} (${shortDate(meet.date)}): ${parts.join(', ')} von ${total} Starts`,
        );
      }
    }
    return lines;
  }

  /** Set when the newest base times are older than the current year. */
  waExpired(): WaExpired | null {
    const sets = this.input.waSets;
    if (!sets.length) return null;
    const current = Number(this.input.today.slice(0, 4));
    const last = Math.max(...sets.map((set) => Number(set.jahr)));
    return last >= current ? null : { last, current };
  }

  /** "Kurzbahn 2026 (gültig bis 31.08.2027)" for each stored table. */
  waInfo(): string {
    return [...this.input.waSets]
      .sort((a, b) => a.von.localeCompare(b.von))
      .map(
        (set) =>
          `${set.bahn === 'Lang' ? 'Langbahn' : 'Kurzbahn'} ${set.jahr} (gültig bis ${longDate(set.bis)}${set.bis < this.input.today ? ', abgelaufen' : ''})`,
      )
      .join(', ');
  }

  /** Members, groups and jubilees of a year, from the member list of the club. */
  memberStats(year: string): MemberStats {
    const y = Number(year);
    const yearOf = (iso: string) => Number(iso.slice(0, 4)) || 0;
    const all = this.input.members;
    const active = all.filter((member) => {
      const joined = yearOf(member.entry);
      const left = yearOf(member.exit);
      return (!joined || joined <= y) && (!left || left > y);
    });
    const reference = y + 1;
    let women = 0;
    let men = 0;
    let other = 0;
    const born: Record<number, number> = {};
    for (const member of active) {
      if (!member.birthYear) continue;
      if (member.sex === 'W') women++;
      else if (member.sex === 'M') men++;
      else other++;
      born[member.birthYear] = (born[member.birthYear] ?? 0) + 1;
    }
    const ages = AGE_BANDS.map(([label, from, to]): [string, number] => {
      let count = 0;
      for (const [birth, number] of Object.entries(born)) {
        const age = reference - Number(birth);
        if (age >= from && age <= to) count += number;
      }
      return [label, count];
    });
    const perGroup = new Map<string, number>();
    for (const member of active) {
      for (const group of member.groups) perGroup.set(group, (perGroup.get(group) ?? 0) + 1);
    }
    const jubilees = JUBILEE_YEARS.map((years) => ({
      years,
      names: all
        .filter((member) => member.entry && y - yearOf(member.entry) === years)
        .map((member) => member.name)
        .sort((a, b) => a.localeCompare(b, 'de')),
    }));
    return {
      joined: all.filter((member) => yearOf(member.entry) === y).length,
      left: all.filter((member) => yearOf(member.exit) === y).length,
      reference,
      total: women + men + other,
      women,
      men,
      other,
      groups: [...perGroup.entries()],
      ages,
      jubilees,
    };
  }
}
