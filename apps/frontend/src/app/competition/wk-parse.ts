import { RunStart, Duty } from './competition.models';

/** What the "Meldeergebnis" (PDF made by EasyWk) says about the club's swimmers and judges. */
export interface ParsedSchedule {
  title: string;
  date: string;
  place: string;
  stand: string;
  starts: RunStart[];
  duties: Duty[];
  eventNames: Record<number, string>;
  clubs: Record<string, number>;
  warnings: string[];
}

function isoDate(text: string): string {
  const match = /(\d{2})\.(\d{2})\.(\d{4})/.exec(text);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

function sexOf(name: string, eventName: string): string {
  const match = /\((M|W|X)\)\s*$/.exec(name);
  if (match) return match[1];
  if (/männlich/i.test(eventName)) return 'M';
  if (/weiblich/i.test(eventName)) return 'W';
  return '';
}

/** Text lines of a PDF page: items of one row sorted by x, big gaps become three spaces. */
export interface PdfItem {
  str: string;
  x: number;
  y: number;
  w: number;
}

export function linesFromItems(pages: PdfItem[][]): string[] {
  const all: string[] = [];
  for (const items of pages) {
    const rows: { y: number; items: PdfItem[] }[] = [];
    const byY = new Map<number, { y: number; items: PdfItem[] }>();
    for (const item of items) {
      if (!item.str) continue;
      const key = Math.round(item.y);
      let row: { y: number; items: PdfItem[] } | undefined;
      for (const delta of [0, -1, 1, -2, 2]) row ??= byY.get(key + delta);
      if (!row) {
        row = { y: item.y, items: [] };
        rows.push(row);
        byY.set(key, row);
      }
      row.items.push(item);
    }
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      let text = '';
      let endX: number | null = null;
      for (const item of row.items) {
        if (endX !== null) {
          const gap = item.x - endX;
          const charWidth = item.w && item.str.length ? item.w / item.str.length : 4;
          if (gap > charWidth * 2.2) text += '   ';
          else if (gap > charWidth * 0.25 && !/^\s/.test(item.str) && !/\s$/.test(text))
            text += ' ';
        }
        text += item.str;
        endX = item.x + (item.w || 0);
      }
      all.push(text);
    }
  }
  return all;
}

interface EventInfo {
  no: number;
  name: string;
  section: number;
}

/** Reads the Meldeergebnis (EasyWk PDF) and keeps the starts and judge slots of one club. */
export function parseMeldeergebnis(lines: string[], club: string): ParsedSchedule {
  const clubLower = club.toLowerCase();
  const out: ParsedSchedule = {
    title: '',
    date: '',
    place: '',
    stand: '',
    starts: [],
    duties: [],
    eventNames: {},
    clubs: {},
    warnings: [],
  };
  const events = new Map<number, EventInfo>();
  const head = lines
    .slice(0, 40)
    .map((line) => line.trim())
    .filter(Boolean);
  const titleAt = head.indexOf('Meldeergebnis');
  if (titleAt >= 0) {
    const parts: string[] = [];
    for (const line of head.slice(titleAt + 1)) {
      if (/^am\s+\d{2}\.\d{2}\.\d{4}/.test(line)) {
        out.date = isoDate(line);
        break;
      }
      if (/^Veranstalter:/.test(line)) break;
      parts.push(line);
    }
    out.title = parts.join(' ');
  }

  let section = 0;
  let current: EventInfo | null = null;
  let heat: { l: number; lt: number; t: string } | null = null;
  let inDuty = false;
  let dutyGroup = '';
  let dutySection = 0;
  let addressLines = 0;
  const address: string[] = [];

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const text = line.trim();
    if (!text) continue;
    let match: RegExpExecArray | null;
    if ((match = /Stand:\s*(\d{2}\.\d{2}\.\d{4}),\s*(\d{2}:\d{2})/.exec(text)) && !out.stand) {
      out.stand = `${isoDate(match[1])} ${match[2]}`;
    }
    if (/Schwimmbad-Adresse/.test(text)) {
      addressLines = 5;
      continue;
    }
    if (addressLines > 0) {
      addressLines--;
      const cells = text.split(/\s{3,}/);
      if (cells.length > 1) address.push(cells[cells.length - 1]);
      else if (/^\s{20,}\S/.test(line)) address.push(text);
      out.place = address.join(', ');
    }
    if ((match = /^Kampfgericht Abschnitt\s+(\d+)/.exec(text))) {
      inDuty = true;
      dutySection = Number(match[1]);
      dutyGroup = 'Kampfgericht';
      continue;
    }
    if (/^Abschnitt\s+(\d+)\s*-\s*\S+\s+\d{2}\.\d{2}\.\d{4}/.test(text)) {
      match = /^Abschnitt\s+(\d+)/.exec(text);
      inDuty = false;
      current = null;
      heat = null;
      section = Number(match?.[1]);
      continue;
    }
    if (/^Wettkampffolge für Abschnitt/.test(text)) {
      inDuty = false;
      continue;
    }
    if (inDuty) {
      if (/^Position\s+Name\s+Verein/.test(text)) continue;
      const cols = text.split(/\s{2,}/);
      if (
        cols.length === 1 &&
        cols[0].length < 40 &&
        !/^(Schiedsrichter|Starter|Sprecher|Auswerter|Protokollf|Computer|Zeitnehmer|Reservezeit|Wenderichter|Zielrichter|Schwimmrichter)/.test(
          cols[0],
        )
      ) {
        dutyGroup = cols[0];
        continue;
      }
      if (cols.length >= 3) {
        const club2 = cols.slice(2).join(' ');
        if (clubLower && club2.toLowerCase().includes(clubLower)) {
          out.duties.push({ a: dutySection, g: dutyGroup, pos: cols[0], name: cols[1] });
        }
      }
      continue;
    }
    if ((match = /^Wettkampf\s+(\d+)\s*-\s*(.+?)\s*$/.exec(text))) {
      const no = Number(match[1]);
      let rest = match[2];
      const clock = /\s*\(ca\.\s*\d{1,2}:\d{2}\s*Uhr\)\s*$/.exec(rest);
      if (clock) rest = rest.slice(0, clock.index);
      const runs = /\s*\(\d+\s*Läufe?\)\s*$/.exec(rest);
      if (runs) rest = rest.slice(0, runs.index);
      const info = events.get(no) ?? { no, name: '', section };
      info.name = rest.trim();
      if (section) info.section = section;
      events.set(no, info);
      out.eventNames[no] = info.name;
      current = info;
      heat = null;
      continue;
    }
    if ((match = /^Lauf\s+(\d+)\s*\/\s*(\d+)\s*-\s*ca\.\s*(\d{1,2}:\d{2})\s*Uhr/.exec(text))) {
      heat = { l: Number(match[1]), lt: Number(match[2]), t: match[3] };
      continue;
    }
    if (/^Bahn\s+Schwimmer/.test(text)) continue;
    if (
      current &&
      heat &&
      (match = /^Bahn\s+(\d+)\s+(.+?)\s+(\d{4}|Offen)\s+(\S.*?)\s+(\d{1,2}:\d{2},\d{2})\s*$/.exec(
        text,
      ))
    ) {
      const clubName = match[4].trim();
      const start: RunStart = {
        e: current.no,
        l: heat.l,
        lt: heat.lt,
        t: heat.t,
        b: Number(match[1]),
        n: match[2].replace(/\s+\((M|W|X)\)\s*$/, '').trim(),
        s: sexOf(match[2], current.name),
        j: match[3] === 'Offen' ? 'Staffel' : match[3],
        m: match[5] === '00:00,00' ? '' : match[5],
      };
      out.clubs[clubName] = (out.clubs[clubName] ?? 0) + 1;
      if (!clubLower || clubName.toLowerCase().includes(clubLower)) out.starts.push(start);
    }
  }
  if (!out.title) out.warnings.push('Titel nicht gefunden.');
  if (events.size === 0) {
    out.warnings.push('Keine Wettkämpfe gefunden. Ist das ein Meldeergebnis aus EasyWk?');
  }
  if (out.starts.length === 0) {
    const names = Object.keys(out.clubs).slice(0, 8).join(', ');
    out.warnings.push(`Für „${club}“ wurden keine Starts gefunden. Im PDF kommen vor: ${names}.`);
  }
  return out;
}

/** Results of one club read from a DSV7 "Wettkampfergebnisliste". */
export interface ParsedResults {
  title: string;
  place: string;
  found: {
    e: number;
    name: string;
    swimmer: string;
    year: string;
    time: string;
    splits: string[];
    status: string;
    place: number;
    ageGroup: string;
  }[];
  judges: { section: number; name: string; role: string }[];
  relays: { e: number; place: number; time: string; status: string }[];
  warnings: string[];
}

const JUDGE_ROLES: Record<string, string> = {
  SCH: 'Schiedsrichter:in',
  STA: 'Starter:in',
  AUS: 'Auswerter:in',
  PKF: 'Protokollführer:in',
  SR: 'Schwimmrichter:in',
  ZR: 'Zielrichter:in',
  WR: 'Wenderichter:in',
  WRO: 'Wenderichter:in',
  ZN: 'Zeitnehmer:in',
  ZNO: 'Zeitnehmer:in',
  RZN: 'Zeitnehmer:in',
  SP: 'Sprecher:in',
  ZBV: 'Kampfrichter:in',
};

/** "0:01:31,39" -> "01:31,39"; zero times are empty. */
function dsvResultTime(text: string | undefined): string {
  const match = /^(\d+):(\d{2}):(\d{2}),(\d{2})$/.exec(text ?? '');
  if (!match) return '';
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes === 0 && Number(match[3]) === 0 && Number(match[4]) === 0) return '';
  return `${String(minutes).padStart(2, '0')}:${match[3]},${match[4]}`;
}

export function parseResultsDsv7(text: string, club: string): ParsedResults {
  const out: ParsedResults = {
    title: '',
    place: '',
    found: [],
    judges: [],
    relays: [],
    warnings: [],
  };
  const clubLower = club.toLowerCase();
  const distance = new Map<string, number>();
  const eventName = new Map<string, string>();
  const splits = new Map<string, { d: number; t: string }[]>();
  const rows: string[][] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, '').replace(/\(\*.*\*\)\s*$/, '');
    const colon = line.indexOf(':');
    if (!line || colon < 0) continue;
    const key = line.slice(0, colon).trim().toUpperCase();
    const f = line
      .slice(colon + 1)
      .split(';')
      .map((part) => part.trim());
    if (key === 'FORMAT' && !/ergebnis/i.test(f[0])) {
      out.warnings.push(`Das ist keine Ergebnisdatei (${f[0]}).`);
    } else if (key === 'VERANSTALTUNG') {
      out.title = f[0];
      out.place = f[1];
    } else if (key === 'WETTKAMPF') {
      distance.set(f[0], Number(f[4]) || 0);
      const relay = Number(f[3]) > 1 ? `${f[3]}x` : '';
      eventName.set(f[0], `${relay}${f[4]} m ${f[5]}`);
    } else if (key === 'KAMPFGERICHT' && (f[3] ?? '').toLowerCase().includes(clubLower) && f[2]) {
      const name = f[2].replace(/^([^,]+),\s*(.+)$/, '$2 $1');
      const role = JUDGE_ROLES[f[1]] ?? 'Kampfrichter:in';
      const section = Number(f[0]) || 1;
      if (!out.judges.some((x) => x.section === section && x.name === name && x.role === role)) {
        out.judges.push({ section, name, role });
      }
    } else if (key === 'STAFFELERGEBNIS' && f.join(';').toLowerCase().includes(clubLower)) {
      const time = f.map((part) => dsvResultTime(part)).find(Boolean) ?? '';
      out.relays.push({
        e: Number(f[0]),
        place: Number(f[3]) || 0,
        time,
        status: time ? '' : /NA|NT/i.test(f[4]) ? 'nicht angetreten' : 'DQ',
      });
    } else if (key === 'PNERGEBNIS') {
      rows.push(f);
    } else if (key === 'PNZWISCHENZEIT') {
      const k = `${f[0]}|${f[1]}`;
      splits.set(k, [...(splits.get(k) ?? []), { d: Number(f[3]), t: dsvResultTime(f[4]) }]);
    }
  }
  const seen = new Set<string>();
  const ageGroups = new Map<string, string>();
  for (const raw of text.split(/\r?\n/)) {
    const match = /^WERTUNG:\s*(\d+);[^;]*;(\d+);[^;]*;[^;]*;[^;]*;[^;]*;([^;]*)/.exec(raw);
    if (match) ageGroups.set(`${match[1]}|${match[2]}`, match[3].trim());
  }
  for (const f of rows) {
    if ((f[11] ?? '').toLowerCase().includes(clubLower) === false) continue;
    const dedupe = `${f[0]}|${f[5]}|${f[13]}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const time = dsvResultTime(f[13]);
    const status = time
      ? ''
      : /NA|NT/i.test(f[4])
        ? 'nicht angetreten'
        : /AB/i.test(f[4])
          ? 'abgemeldet'
          : 'DQ';
    const parts = (splits.get(`${f[7]}|${f[0]}`) ?? [])
      .filter((part) => part.t && part.d < (distance.get(f[0]) ?? 9999))
      .sort((a, b) => a.d - b.d)
      .map((part) => part.t);
    out.found.push({
      e: Number(f[0]),
      name: eventName.get(f[0]) ?? '',
      swimmer: f[5],
      year: f[9] ?? '',
      time,
      splits: parts,
      status,
      place: Number(f[3]) || 0,
      ageGroup: ageGroups.get(`${f[0]}|${f[2]}`) ?? '',
    });
  }
  if (out.found.length === 0) out.warnings.push(`Keine Ergebnisse für „${club}“ gefunden.`);
  return out;
}
