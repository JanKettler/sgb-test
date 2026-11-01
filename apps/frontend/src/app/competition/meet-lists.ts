import { escapeHtml } from './competition-download';
import {
  CompSection,
  Competition,
  RunStart,
  dateOf,
  displayName,
  eventTitle,
  showTime,
  startKey,
} from './competition.models';
import { XlsxBook, XlsxSheet } from './xlsx';

/**
 * The lists for the pool deck, built from the Meldeergebnis: start list, run slips by event or by
 * swimmer, and the overview per swimmer. Every list exists as an Excel book and as a print page,
 * both made from the same lines so that heats and lanes are the same everywhere.
 */

export type SlipOrder = 'event' | 'swimmer';

export interface ListLine {
  /** Section of the event (1 when the event list does not know it). */
  section: number;
  /** "10:05", empty when the start was only added from a result list. */
  time: string;
  event: number;
  /** "100m Brust": the name from the Meldeergebnis without the sex. */
  distance: string;
  /** "3/7": heat 3 of 7. */
  heat: string;
  lane: number;
  /** "Anna Muster". */
  swimmer: string;
  /** Year of birth or "Staffel". */
  year: string;
  /** Entry time as "1:57,66", "–" without one. */
  entry: string;
  /** Key of the start in `Schedule.results`. */
  key: string;
  start: RunStart;
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** "Sa, 30.05.2026" for an ISO date. */
export function germanDay(iso: string): string {
  if (!iso) return '';
  const day = new Date(`${iso}T12:00:00`);
  return `${WEEKDAYS[day.getDay()]}, ${iso.split('-').reverse().join('.')}`;
}

/** Third header line of every list: meet, day and place. */
export function meetSubtitle(item: Competition): string {
  return [item.title, germanDay(dateOf(item)), item.place].filter(Boolean).join(' · ');
}

/** "100m Brust weiblich" is listed as "100m Brust": the sex is in the event list anyway. */
export function plainEventName(name: string): string {
  return name.replace(/\s+(männlich|weiblich|mixed)$/i, '');
}

export function listLines(item: Competition): ListLine[] {
  return item.schedule.starts.map((start) => ({
    section: item.events.find((event) => event.no === start.e)?.section ?? 1,
    time: start.t,
    event: start.e,
    distance: plainEventName(eventTitle(item, start.e)),
    heat: `${start.l}/${start.lt}`,
    lane: start.b,
    swimmer: displayName(start.n),
    year: start.j,
    entry: showTime(start.m) || '–',
    key: startKey(start),
    start,
  }));
}

/** "9:05" and "09:05" sort the same. */
function timeKey(time: string): string {
  return time.padStart(5, '0');
}

export function byEvent(lines: ListLine[]): ListLine[] {
  return [...lines].sort(
    (a, b) =>
      a.section - b.section || a.event - b.event || a.start.l - b.start.l || a.lane - b.lane,
  );
}

export function byTime(lines: ListLine[]): ListLine[] {
  return [...lines].sort(
    (a, b) =>
      a.section - b.section ||
      timeKey(a.time).localeCompare(timeKey(b.time)) ||
      a.event - b.event ||
      a.lane - b.lane,
  );
}

/** By name ("Lastname, Firstname"), then by time of day; relay teams ("1. Mannschaft") come first. */
export function bySwimmer(lines: ListLine[]): ListLine[] {
  return [...lines].sort(
    (a, b) =>
      a.start.n.localeCompare(b.start.n, 'de') ||
      a.year.localeCompare(b.year) ||
      timeKey(a.time).localeCompare(timeKey(b.time)) ||
      a.event - b.event,
  );
}

export function slipLines(item: Competition, order: SlipOrder): ListLine[] {
  return order === 'event' ? byEvent(listLines(item)) : bySwimmer(listLines(item));
}

function isOpenDuty(name: string): boolean {
  return !name || /^N\s?N$/i.test(name);
}

function slipTitle(order: SlipOrder): string {
  return order === 'event' ? 'Laufzettel nach Wettkampffolge' : 'Laufzettel nach Schwimmern';
}

/** Index of the last line of every section but the last one, to start each on a new page. */
function sectionBreaks(lines: ListLine[]): number[] {
  const breaks: number[] = [];
  lines.forEach((line, index) => {
    if (index < lines.length - 1 && lines[index + 1].section !== line.section) breaks.push(index);
  });
  return breaks;
}

/** Run slips: one row per start with room for the end time and the intermediate times. */
export function slipsBook(item: Competition, order: SlipOrder): XlsxBook {
  const lines = slipLines(item, order);
  const multi = item.sections.length > 1;
  const sheet: XlsxSheet = {
    name: 'Laufzettel',
    head: [
      ...(multi ? ['Abs.'] : []),
      'Uhr',
      'WK',
      'Strecke',
      'Lauf',
      'Bahn',
      'Schwimmer',
      'Jg.',
      'Meldezeit',
      'Endzeit',
      'Zwischenzeiten',
    ],
    rows: lines.map((line) => [
      ...(multi ? [line.section] : []),
      line.time,
      line.event,
      line.distance,
      line.heat,
      line.lane,
      line.swimmer,
      line.year,
      line.entry,
      '',
      '',
    ]),
    widths: [...(multi ? [6] : []), 8, 6, 26, 8, 6, 26, 8, 11, 14, 28],
    formats: [
      ...(multi ? (['center'] as const) : []),
      'center',
      'center',
      'text',
      'center',
      'center',
      'text',
      'center',
      'center',
      'text',
      'text',
    ],
    orientation: 'landscape',
    rowHeight: 26,
    breaksAfter: multi && order === 'event' ? sectionBreaks(lines) : [],
  };
  return { title: slipTitle(order), subtitle: meetSubtitle(item), sheets: [sheet] };
}

/** Start list in the order of the day, plus the judges the club has to send. */
export function startListBook(item: Competition): XlsxBook {
  const lines = byTime(listLines(item));
  const multi = item.sections.length > 1;
  const sheets: XlsxSheet[] = [
    {
      name: 'Startliste',
      head: [
        ...(multi ? ['Abs.'] : []),
        'Uhr',
        'Schwimmer',
        'Jg.',
        'WK',
        'Strecke',
        'Lauf',
        'Bahn',
        'Meldezeit',
      ],
      rows: lines.map((line) => [
        ...(multi ? [line.section] : []),
        line.time,
        line.swimmer,
        line.year,
        line.event,
        line.distance,
        line.heat,
        line.lane,
        line.entry,
      ]),
      widths: [...(multi ? [6] : []), 8, 26, 8, 6, 26, 8, 6, 11],
      formats: [
        ...(multi ? (['center'] as const) : []),
        'center',
        'text',
        'center',
        'center',
        'text',
        'center',
        'center',
        'center',
      ],
      orientation: 'portrait',
      rowHeight: 20,
      breaksAfter: [],
    },
  ];
  if (item.schedule.duties.length > 0) {
    sheets.push({
      name: 'Kampfgericht',
      head: ['Abschnitt', 'Position', 'Gruppe', 'Name'],
      rows: item.schedule.duties.map((duty) => [
        duty.a,
        duty.pos,
        duty.g,
        isOpenDuty(duty.name) ? 'noch offen' : duty.name,
      ]),
      widths: [11, 30, 30, 30],
      formats: ['center', 'text', 'text', 'text'],
      orientation: 'portrait',
    });
  }
  return { title: 'Startliste', subtitle: meetSubtitle(item), sheets };
}

/** File name of a list: "Laufzettel_8_Hunteschwimmmeeting.xlsx". */
export function listFileName(prefix: string, item: Competition, extension = 'xlsx'): string {
  const name = item.title
    .replace(/[^A-Za-z0-9ÄÖÜäöüß]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return `${prefix}_${name || 'Wettkampf'}.${extension}`;
}

// ---- Print pages ---------------------------------------------------------------------------

export interface PrintPage {
  title: string;
  body: string;
  landscape: boolean;
  css: string;
}

function heading(item: Competition, what: string): string {
  return `<h1>${escapeHtml(what)}</h1><div class="sub">${escapeHtml(meetSubtitle(item))}</div>`;
}

/** "Einlass 09:00", "Einschwimmen 09:15" …: only the times that are set ("00:00" is none). */
export function sectionTimes(section: CompSection): string[] {
  const set = (time: string) => !!time && time !== '00:00';
  return [
    set(section.entry) && `Einlass ${section.entry}`,
    set(section.warmup) && `Einschwimmen ${section.warmup}`,
    set(section.judges) && `Kampfrichtersitzung ${section.judges}`,
    // A later section that starts after the previous one has no fixed time of day.
    set(section.start) && !section.relative && `Beginn ${section.start}`,
  ].filter((part): part is string => !!part);
}

function sectionLine(item: Competition): string {
  return item.sections
    .map((section) => {
      const parts = sectionTimes(section);
      return parts.length > 0
        ? `<div class="sub">Abschnitt ${section.no}: ${escapeHtml(parts.join(' · '))}</div>`
        : '';
    })
    .join('');
}

export function startListPage(item: Competition): PrintPage {
  const multi = item.sections.length > 1;
  let last = 0;
  const rows = byTime(listLines(item))
    .map((line) => {
      const block =
        multi && line.section !== last
          ? `<tr><td colspan="4" class="band">Abschnitt ${line.section}</td></tr>`
          : '';
      last = line.section;
      return (
        block +
        `<tr><td class="nowrap"><b>${escapeHtml(line.time)}</b></td>` +
        `<td><b>${escapeHtml(line.swimmer)}</b> (${escapeHtml(line.year)})<br>WK ${line.event} · ${escapeHtml(line.distance)}</td>` +
        `<td class="nowrap">Lauf ${line.heat}<br>Bahn ${line.lane}</td>` +
        `<td class="nowrap">${line.entry === '–' ? 'ohne' : escapeHtml(line.entry)}</td></tr>`
      );
    })
    .join('');
  const duties = item.schedule.duties
    .map(
      (duty) =>
        `<tr><td>${duty.a}</td><td>${escapeHtml(duty.pos)}</td><td>${isOpenDuty(duty.name) ? '<i>noch offen</i>' : escapeHtml(duty.name)}</td></tr>`,
    )
    .join('');
  return {
    title: `Startliste ${item.title}`,
    body:
      `${heading(item, 'Startliste')}<table><thead><tr><th>Uhr</th><th>Schwimmer / Strecke</th><th>Lauf / Bahn</th><th>Meldezeit</th></tr></thead><tbody>${rows}</tbody></table>` +
      sectionLine(item) +
      (duties
        ? `<h2>Kampfgericht</h2><table><thead><tr><th>Abschn.</th><th>Position</th><th>Name</th></tr></thead><tbody>${duties}</tbody></table>`
        : ''),
    landscape: false,
    css: '.band{background:#e8edf5;font-weight:700}',
  };
}

export function slipsPage(item: Competition, order: SlipOrder): PrintPage {
  const lines = slipLines(item, order);
  const multi = item.sections.length > 1;
  const head =
    `<thead><tr>${multi ? '<th>Abs.</th>' : ''}<th>Uhr</th><th>WK</th><th>Strecke</th><th>Lauf</th><th>Bahn</th>` +
    '<th>Schwimmer</th><th>Jg.</th><th>Meldezeit</th><th style="width:16%">Endzeit</th><th style="width:26%">Zwischenzeiten</th></tr></thead>';
  const row = (line: ListLine) =>
    `<tr>${multi ? `<td class="mid">${line.section}</td>` : ''}<td class="nowrap"><b>${escapeHtml(line.time)}</b></td>` +
    `<td class="mid">${line.event}</td><td>${escapeHtml(line.distance)}</td><td class="mid">${line.heat}</td>` +
    `<td class="mid">${line.lane}</td><td class="nowrap"><b>${escapeHtml(line.swimmer)}</b></td>` +
    `<td class="mid">${escapeHtml(line.year)}</td><td class="nowrap mid">${escapeHtml(line.entry)}</td><td></td><td></td></tr>`;
  // By event every section gets its own page, by swimmer one table runs through.
  const groups =
    multi && order === 'event'
      ? [...new Set(lines.map((line) => line.section))].map((section) =>
          lines.filter((line) => line.section === section),
        )
      : [lines];
  const body = groups
    .map(
      (group, index) =>
        `<div${index < groups.length - 1 ? ' class="pb"' : ''}><table class="lz">${head}<tbody>${group.map(row).join('')}</tbody></table></div>`,
    )
    .join('');
  return {
    title: `Laufzettel ${item.title}`,
    body: heading(item, slipTitle(order)) + body,
    landscape: true,
    css: 'table.lz td{height:30px;font-size:11.5px;padding:3px 5px;vertical-align:middle}table.lz th{font-size:11px}.mid{text-align:center}',
  };
}

/** One slip per swimmer with all starts: for the parents and for the swimmers themselves. */
export function overviewPage(item: Competition): PrintPage {
  const groups = new Map<string, ListLine[]>();
  for (const line of bySwimmer(listLines(item))) {
    const key = `${line.start.n}|${line.year}`;
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  const slips = [...groups.values()]
    .map((lines) => {
      const starts = lines
        .map(
          (line) =>
            `${escapeHtml(line.time)} Uhr · ${escapeHtml(line.distance)} · Lauf ${line.heat} · Bahn ${line.lane}`,
        )
        .join('<br>');
      return `<div class="slip"><b>${escapeHtml(lines[0].swimmer)}</b> (${escapeHtml(lines[0].year)})<br>${starts}</div>`;
    })
    .join('');
  return {
    title: `Meine Starts ${item.title}`,
    body: heading(item, 'Meine Starts') + slips,
    landscape: false,
    css: '',
  };
}
