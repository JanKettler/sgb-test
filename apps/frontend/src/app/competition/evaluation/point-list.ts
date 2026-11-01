import { PointRow } from './evaluation.model';

export interface PointListRead {
  rows: PointRow[];
  warnings: string[];
  /** Season named in the title line of the file, empty when there is none. */
  season: string;
}

/**
 * Reads the list "Punktbeste Leistung nach World Aquatics" of WebClub as CSV. The title line names
 * the season ("Saison 2026"); the header line reads "Schwimmer;Jg;M/W;50S;100S;…;Gesamt".
 */
export function parsePointListCsv(text: string): PointListRead {
  const rows: PointRow[] = [];
  const warnings: string[] = [];
  let season = '';
  let head: string[] | null = null;
  const columns: [number, string][] = [];
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];
    if (!raw.trim()) continue;
    const fields = raw.split(';').map((part) => part.trim());
    if (!head) {
      const found = /Saison\s+(\d{4})/.exec(raw);
      if (found) season = found[1];
      if (/^Schwimmer$/i.test(fields[0])) {
        head = fields;
        fields.forEach((name, at) => {
          if (at < 3 || !name || /^Gesamt$/i.test(name)) return;
          if (/^\d+[SRBFL]$/.test(name)) columns.push([at, name]);
          else warnings.push(`Unbekannte Spalte „${name}“ wird ignoriert.`);
        });
      }
      continue;
    }
    if (!fields[0]) continue;
    const jg = Number(fields[1]);
    const sex = (fields[2] ?? '').toUpperCase();
    if (!(jg > 1900 && jg < 2100)) {
      warnings.push(
        `Zeile ${index + 1} (${fields[0]}): Jahrgang „${fields[1] ?? ''}“ ist nicht lesbar.`,
      );
    }
    if (sex !== 'M' && sex !== 'W') {
      warnings.push(
        `Zeile ${index + 1} (${fields[0]}): Geschlecht „${fields[2] ?? ''}“ ist nicht M oder W.`,
      );
    }
    const row: PointRow = { name: fields[0], jg: jg || 0, sex, p: {}, ges: 0 };
    for (const [at, code] of columns) {
      const points = Number(fields[at] || 0);
      if (points > 0) {
        row.p[code] = points;
        row.ges += points;
      }
    }
    const total = head.findIndex((name) => /^Gesamt$/i.test(name));
    const given = total >= 0 ? (fields[total] ?? '') : '';
    if (given !== '' && Number(given) !== row.ges) {
      warnings.push(
        `${fields[0]}: Gesamt ${given} passt nicht zur Summe der Strecken (${row.ges}).`,
      );
    }
    rows.push(row);
  }
  if (!head) {
    warnings.push(
      'Die Kopfzeile „Schwimmer;Jg;M/W;…“ wurde nicht gefunden. Ist das die Liste „Punktbeste Leistung nach World Aquatics“?',
    );
  }
  return { rows, warnings, season };
}
