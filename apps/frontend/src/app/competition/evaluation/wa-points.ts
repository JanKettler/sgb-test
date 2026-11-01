/**
 * World Aquatics points. A table holds the "base time" of every event (the time for 1000 points);
 * the points of a time are floor(1000 × (base time / time)³). Base times are read from a CSV file
 * or from the six official PDF tables of a year.
 */

export type Course = 'SCM' | 'LCM';
export type PoolKind = 'Kurz' | 'Lang';

export const COURSE_NAME: Record<Course, string> = { SCM: 'Kurzbahn', LCM: 'Langbahn' };

const STROKE_CODE: Record<string, string> = {
  FREE: 'F',
  BACK: 'R',
  BREAST: 'B',
  FLY: 'S',
  MEDLEY: 'L',
};
const CODE_STROKE: Record<string, string> = {
  F: 'FREE',
  R: 'BACK',
  B: 'BREAST',
  S: 'FLY',
  L: 'MEDLEY',
};
/** Individual events per sex that a complete table has (used to warn about incomplete files). */
const EXPECTED: Record<Course, number> = { SCM: 18, LCM: 17 };

/** The stored base times of one course and year. `t` maps "M|1|100|FREE" to hundredths. */
export interface WaSet {
  id: string;
  bahn: PoolKind;
  jahr: string;
  /** ISO dates between which the table is valid. */
  von: string;
  bis: string;
  t: Record<string, number>;
  /** ISO date of the upload. */
  stand: string;
  file: string;
}

/** A table as read from a file, before it is stored. */
export interface WaRead {
  id: string;
  course: Course;
  jahr: string;
  von: string;
  bis: string;
  t: Record<string, number>;
  count: number;
}

export interface WaResult {
  sets: Record<string, WaRead>;
  list: WaRead[];
  errors: string[];
  warnings: string[];
}

export function waKey(sex: string, count: number, distance: number, stroke: string): string {
  return `${sex}|${count}|${distance}|${stroke}`;
}

/** "1:38.61", "01:38,61" and "19.90" as hundredths of a second. */
export function parseWaTime(text: string): number | null {
  const match = /^(?:(\d{1,2}):)?(\d{1,2})[.,](\d{2})$/.exec(text.trim());
  if (!match) return null;
  return (Number(match[1] ?? 0) * 60 + Number(match[2])) * 100 + Number(match[3]);
}

/** Short course tables run from September to August, long course tables for the calendar year. */
export function waDefaults(course: Course, year: number): { von: string; bis: string } {
  return course === 'SCM'
    ? { von: `${year}-09-01`, bis: `${year + 1}-08-31` }
    : { von: `${year}-01-01`, bis: `${year}-12-31` };
}

function emptyRead(): WaResult {
  return { sets: {}, list: [], errors: [], warnings: [] };
}

function setOf(out: WaResult, course: Course, year: string): WaRead {
  const id = `${course}-${year}`;
  let set = out.sets[id];
  if (!set) {
    const range = waDefaults(course, Number(year));
    set = { id, course, jahr: year, von: range.von, bis: range.bis, t: {}, count: 0 };
    out.sets[id] = set;
  }
  return set;
}

function isDuplicate(out: WaResult, set: WaRead, key: string, label: string): boolean {
  if (set.t[key] === undefined) return false;
  out.errors.push(`${label}: ${key.replaceAll('|', ' ')} kommt doppelt vor.`);
  return true;
}

function finish(out: WaResult): WaResult {
  out.list = Object.keys(out.sets)
    .sort()
    .map((id) => {
      const set = out.sets[id];
      const singles: Record<string, number> = { M: 0, F: 0 };
      for (const key of Object.keys(set.t)) {
        const [sex, count] = key.split('|');
        if (count === '1' && singles[sex] !== undefined) singles[sex]++;
      }
      for (const sex of ['M', 'F']) {
        const label = `${COURSE_NAME[set.course]} ${set.jahr}`;
        const who = sex === 'M' ? 'Männer' : 'Frauen';
        if (singles[sex] > 0 && singles[sex] < EXPECTED[set.course]) {
          out.warnings.push(
            `${label}: für ${who} nur ${singles[sex]} von ${EXPECTED[set.course]} Einzelstrecken.`,
          );
        }
        if (!singles[sex]) out.warnings.push(`${label}: keine Einzelstrecken für ${who}.`);
      }
      set.count = Object.keys(set.t).length;
      return set;
    });
  return out;
}

/** CSV without header: `Jahr;Bahn;Geschlecht;Anzahl;Strecke;Lage;Zeit[;Sekunden]`. */
export function parseWaCsv(text: string): WaResult {
  const out = emptyRead();
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  lines.forEach((raw, index) => {
    const lineNo = index + 1;
    if (!raw.trim()) return;
    const f = raw.split(/;|\t/).map((part) => part.trim());
    if (!/^\d{4}$/.test(f[0])) {
      if (index === 0) return;
      out.errors.push(`Zeile ${lineNo}: beginnt nicht mit einem Jahr.`);
      return;
    }
    if (f.length < 7) {
      out.errors.push(
        `Zeile ${lineNo}: zu wenige Spalten (erwartet: Jahr;Bahn;Geschlecht;Anzahl;Strecke;Lage;Zeit).`,
      );
      return;
    }
    const course = f[1].toUpperCase();
    let sex = f[2].toUpperCase();
    if (sex === 'W') sex = 'F';
    const count = Number(f[3]);
    const distance = Number(f[4]);
    const stroke = f[5].toUpperCase();
    const hundredths = parseWaTime(f[6]);
    if (course !== 'SCM' && course !== 'LCM') {
      out.errors.push(`Zeile ${lineNo}: Bahn „${f[1]}“ ist unbekannt (SCM oder LCM).`);
      return;
    }
    if (!['M', 'F', 'X'].includes(sex)) {
      out.errors.push(`Zeile ${lineNo}: Geschlecht „${f[2]}“ ist unbekannt (M, F oder X).`);
      return;
    }
    if (!(count >= 1 && count <= 4) || !(distance >= 25 && distance <= 1500)) {
      out.errors.push(`Zeile ${lineNo}: Anzahl oder Strecke ist ungültig.`);
      return;
    }
    if (!STROKE_CODE[stroke]) {
      out.errors.push(`Zeile ${lineNo}: Lage „${f[5]}“ ist unbekannt.`);
      return;
    }
    if (hundredths === null) {
      out.errors.push(`Zeile ${lineNo}: Zeit „${f[6]}“ ist nicht lesbar.`);
      return;
    }
    if (f[7]) {
      const seconds = parseFloat(f[7].replace(',', '.'));
      if (Number.isFinite(seconds) && Math.abs(seconds * 100 - hundredths) > 1.5) {
        const what = `${f[2]} ${count > 1 ? `${count}x` : ''}${distance} ${f[5]}`;
        out.errors.push(
          `Zeile ${lineNo} (${what}): Zeit ${f[6]} und Sekunden ${f[7]} passen nicht zusammen. Bitte in der World-Aquatics-Tabelle bei 1000 Punkten nachsehen.`,
        );
        return;
      }
    }
    const set = setOf(out, course, f[0]);
    const key = waKey(sex, count, distance, stroke);
    if (isDuplicate(out, set, key, `Zeile ${lineNo}`)) return;
    set.t[key] = hundredths;
  });
  return finish(out);
}

/** The events in the order of the columns of a World Aquatics PDF table. */
function pdfColumns(
  course: Course,
  kind: 'ind' | 'rel',
  sex: string,
): [string, number, number, string][] {
  if (kind === 'ind') {
    const cols: [string, number][] = [];
    for (const distance of [50, 100, 200, 400, 800, 1500]) cols.push(['FREE', distance]);
    for (const stroke of ['BACK', 'BREAST', 'FLY']) {
      for (const distance of [50, 100, 200]) cols.push([stroke, distance]);
    }
    for (const distance of course === 'SCM' ? [100, 200, 400] : [200, 400]) {
      cols.push(['MEDLEY', distance]);
    }
    return cols.map(([stroke, distance]) => [sex, 1, distance, stroke]);
  }
  return course === 'SCM'
    ? [
        ['F', 4, 50, 'FREE'],
        ['F', 4, 100, 'FREE'],
        ['F', 4, 200, 'FREE'],
        ['F', 4, 50, 'MEDLEY'],
        ['F', 4, 100, 'MEDLEY'],
        ['M', 4, 50, 'FREE'],
        ['M', 4, 100, 'FREE'],
        ['M', 4, 200, 'FREE'],
        ['M', 4, 50, 'MEDLEY'],
        ['M', 4, 100, 'MEDLEY'],
        ['X', 4, 50, 'FREE'],
        ['X', 4, 50, 'MEDLEY'],
      ]
    : [
        ['F', 4, 100, 'FREE'],
        ['F', 4, 200, 'FREE'],
        ['F', 4, 100, 'MEDLEY'],
        ['M', 4, 100, 'FREE'],
        ['M', 4, 200, 'FREE'],
        ['M', 4, 100, 'MEDLEY'],
        ['X', 4, 100, 'FREE'],
        ['X', 4, 100, 'MEDLEY'],
      ];
}

function isoDate(dmy: string): string {
  const match = /(\d{2})\/(\d{2})\/(\d{4})/.exec(dmy);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

/** One official PDF table: only the row for 1000 points is read. */
export function parseWaPdf(lines: string[], name: string): WaResult {
  const out = emptyRead();
  const label = name || 'Die Datei';
  const text = lines.join('\n');
  const year = /Point Scoring\s+(\d{4})/i.exec(text);
  const course = /(Short|Long)\s+Course/i.exec(text);
  if (!year || !course) {
    out.errors.push(`${label} ist keine World-Aquatics-Punktetabelle.`);
    return finish(out);
  }
  const kind = /Relay\s*-/i.test(text) ? 'rel' : 'ind';
  const courseKey: Course = /short/i.test(course[1]) ? 'SCM' : 'LCM';
  let sex = '';
  if (kind === 'ind') {
    if (/Women\s+Individual/i.test(text)) sex = 'F';
    else if (/Men\s+Individual/i.test(text)) sex = 'M';
    else {
      out.errors.push(`${label}: Geschlecht nicht erkannt.`);
      return finish(out);
    }
  }
  let row: string[] | null = null;
  for (const line of lines) {
    const match = /^\s*1000\s+(.+?)\s+1000\s*$/.exec(line);
    if (match && !row) row = match[1].match(/\d{1,2}:\d{2}\.\d{2}|\d+\.\d{2}/g);
  }
  if (!row) {
    out.errors.push(`${label}: Die Zeile für 1000 Punkte wurde nicht gefunden.`);
    return finish(out);
  }
  const cells: string[] = row;
  const columns = pdfColumns(courseKey, kind, sex);
  if (cells.length !== columns.length) {
    out.errors.push(
      `${label}: ${cells.length} Zeiten in der 1000-Punkte-Zeile gefunden, erwartet waren ${columns.length}.`,
    );
    return finish(out);
  }
  const validity = /Validity\s*-\s*\(\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/i.exec(
    text,
  );
  const set = setOf(out, courseKey, year[1]);
  if (validity) {
    set.von = isoDate(validity[1]);
    set.bis = isoDate(validity[2]);
  }
  columns.forEach(([colSex, count, distance, stroke], index) => {
    const hundredths = parseWaTime(cells[index]);
    if (hundredths === null) {
      out.errors.push(`${label}: eine Zeit ist nicht lesbar.`);
      return;
    }
    const key = waKey(colSex, count, distance, stroke);
    if (!isDuplicate(out, set, key, label)) set.t[key] = hundredths;
  });
  return finish(out);
}

/** Puts the results of several files together; two different times for one event are an error. */
export function mergeWa(results: readonly WaResult[]): WaResult {
  const out = emptyRead();
  for (const result of results) {
    out.errors.push(...result.errors);
    for (const read of result.list) {
      const set = setOf(out, read.course, read.jahr);
      set.von = read.von;
      set.bis = read.bis;
      for (const key of Object.keys(read.t)) {
        if (set.t[key] !== undefined && set.t[key] !== read.t[key]) {
          out.errors.push(
            `Widerspruch bei ${COURSE_NAME[read.course]} ${read.jahr}: ${key.replaceAll('|', ' ')} steht mit zwei Zeiten in den Dateien.`,
          );
        }
        set.t[key] = read.t[key];
      }
    }
  }
  return finish(out);
}

/** The table that applies to a date and pool kind: by validity, then by year, then the nearest. */
export function pickWaSet(sets: readonly WaSet[], bahn: PoolKind | '', date: string): WaSet | null {
  let best: WaSet | null = null;
  const year = date.slice(0, 4);
  for (const set of sets) {
    if (set.bahn !== bahn) continue;
    if (!date || (set.von && date < set.von) || (set.bis && date > set.bis)) continue;
    if (!best || set.von > best.von) best = set;
  }
  if (best) return best;
  for (const set of sets) if (set.bahn === bahn && set.jahr === year) best = set;
  if (best) return best;
  const at = Date.parse(date);
  for (const set of sets) {
    if (set.bahn !== bahn) continue;
    if (!best || Math.abs(Date.parse(set.von) - at) < Math.abs(Date.parse(best.von) - at)) {
      best = set;
    }
  }
  return best;
}

/**
 * Points of a time. `code` is the distance and stroke ("50F", "100L"), `ms` the time in
 * milliseconds. 25 m events do not exist at World Aquatics: distance and time are doubled, the
 * points of the 50 m event halved and rounded.
 */
export function waPoints(
  sets: readonly WaSet[],
  sex: string,
  bahn: PoolKind | '',
  code: string,
  date: string,
  ms: number,
): number | null {
  const match = /^(\d+)([SRBFL])$/.exec(code);
  if (!match || !(ms > 0)) return null;
  const gender = sex === 'W' ? 'F' : sex;
  if (gender !== 'M' && gender !== 'F') return null;
  const set = pickWaSet(sets, bahn, date);
  if (!set) return null;
  const distance = Number(match[1]);
  const base = set.t[waKey(gender, 1, distance, CODE_STROKE[match[2]])];
  if (!base && distance === 25 && match[2] !== 'L') {
    const fifty = waPoints(sets, sex, bahn, `50${match[2]}`, date, ms * 2);
    return fifty === null ? null : Math.floor(fifty / 2 + 0.5);
  }
  if (!base) return null;
  return Math.floor(1000 * Math.pow(base / (ms / 10), 3) + 1e-9);
}

/** Id under which a table is stored. */
export function waSetId(course: Course, year: string): string {
  return `wa-${course.toLowerCase()}-${year}`;
}

/** Turns a table read from a file into a stored one. */
export function toWaSet(
  read: WaRead,
  von: string,
  bis: string,
  today: string,
  file: string,
): WaSet {
  return {
    id: waSetId(read.course, read.jahr),
    bahn: read.course === 'SCM' ? 'Kurz' : 'Lang',
    jahr: read.jahr,
    von,
    bis,
    t: read.t,
    stand: today,
    file,
  };
}
