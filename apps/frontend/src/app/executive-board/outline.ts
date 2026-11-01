/** Level 0 is numbered 1., 2.; level 1 is lettered a., b.; level 2 is roman i., ii. */
export type OutlineLevel = 0 | 1 | 2;

export interface OutlinePoint {
  kind: 'point';
  level: OutlineLevel;
  label: string;
  text: string;
}

export interface OutlineTable {
  kind: 'table';
  rows: string[][];
}

export type OutlineItem = OutlinePoint | OutlineTable;

export interface Segment {
  text: string;
  /** A name in [square brackets] is highlighted. */
  mark: boolean;
}

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];

function letter(index: number): string {
  return String.fromCharCode(97 + (index % 26)).repeat(Math.floor(index / 26) + 1);
}

function labelOf(level: OutlineLevel, index: number): string {
  if (level === 0) return `${index + 1}.`;
  if (level === 1) return `${letter(index)}.`;
  return `${ROMAN[index] ?? String(index + 1)}.`;
}

function cellsOf(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

/**
 * Turns the text of minutes into an outline. A line is a point (numbered automatically); "- " at
 * the start makes it a sub point, "-- " a point below that. Lines that start with "|" form a
 * table whose cells are separated by "|".
 */
export function parseOutline(text: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  const counters = [0, 0, 0];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('|')) {
      const cells = cellsOf(line);
      if (/^[\s:|-]*$/.test(cells.join(''))) continue;
      const last = items.at(-1);
      if (last?.kind === 'table') last.rows.push(cells);
      else items.push({ kind: 'table', rows: [cells] });
      continue;
    }
    const level: OutlineLevel = line.startsWith('-- ') ? 2 : line.startsWith('- ') ? 1 : 0;
    counters[level]++;
    for (let deeper = level + 1; deeper < counters.length; deeper++) counters[deeper] = 0;
    items.push({
      kind: 'point',
      level,
      label: labelOf(level, counters[level] - 1),
      text: line.replace(/^-{1,2}\s+/, ''),
    });
  }
  return items;
}

/**
 * The text of a letter: blocks separated by a blank line are paragraphs (a point without a label),
 * lines that start with "|" form a table.
 */
export function parseLetter(text: string): OutlineItem[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block !== '')
    .flatMap<OutlineItem>((block) =>
      block.startsWith('|')
        ? parseOutline(block).filter((item) => item.kind === 'table')
        : [{ kind: 'point', level: 0, label: '', text: block }],
    );
}

/** Splits a text into plain parts and names in [square brackets]. */
export function segmentsOf(text: string): Segment[] {
  const parts: Segment[] = [];
  const pattern = /\[([^\]]+)\]/g;
  let from = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > from) parts.push({ text: text.slice(from, match.index), mark: false });
    parts.push({ text: match[1], mark: true });
    from = match.index + match[0].length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), mark: false });
  return parts;
}

/** The agenda as the first lines of the minutes, one point per item. */
export function minutesFromAgenda(agenda: readonly string[]): string {
  return agenda.map((item) => `${item}\n`).join('');
}
