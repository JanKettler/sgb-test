import { timeMs, showTime } from '../competition.models';
import {
  Evaluation,
  money,
  shortDate,
  sheetDiff,
  strokeLabel,
  strokeSort,
} from './evaluation.logic';
import { Block, Cell, ReportPart, Row, Swimmer } from './evaluation.model';

const RANK_HEAD = [
  'Platz',
  'Schwimmer',
  'Jahrgang',
  'M/W/D',
  'Veranstaltungen',
  'Starts',
  'Anzahl Strecken',
  'Erreichte Punkte',
  'Durchschnitt Punkte',
];

const MEDALS = ['Gold', 'Silber', 'Bronze'];

function head(labels: string[]): Row {
  return { cells: labels.map((v) => ({ v, head: true })) };
}

function title(text: string, level: 1 | 2 = 2): Block {
  return { type: 'title', text, level };
}

/**
 * A table of swimmers; the places are counted from 1 in every table, like on the paper list.
 * `top` cuts the table to the first places.
 */
export function rankTable(
  ev: Evaluation,
  year: string,
  heading: string,
  list: Swimmer[],
  top = 0,
): Block[] {
  if (!list.length) return [];
  const starts = ev.starts(year);
  const shown = top ? list.slice(0, top) : list;
  const data = shown.map((swimmer, index) => {
    const own = starts[swimmer.name.toLowerCase()] ?? [];
    const meets = new Set(own.map((start) => start.meetId));
    return {
      swimmer,
      place: index + 1,
      meets: own.length ? meets.size : 0,
      starts: own.length,
    };
  });
  const max = { meets: 0, starts: 0, n: 0, ges: 0, avg: 0 };
  for (const row of data) {
    max.meets = Math.max(max.meets, row.meets);
    max.starts = Math.max(max.starts, row.starts);
    max.n = Math.max(max.n, row.swimmer.n);
    max.ges = Math.max(max.ges, row.swimmer.ges);
    max.avg = Math.max(max.avg, row.swimmer.avg);
  }
  const best = (value: number, highest: number, text: string | number): Cell => ({
    v: text,
    bold: value === highest && highest > 0,
  });
  const rows: Row[] = [
    head(RANK_HEAD),
    ...data.map(
      (row): Row => ({
        cells: [
          { v: row.place, align: 'r' },
          { v: row.swimmer.name, align: 'l' },
          { v: row.swimmer.jg },
          { v: row.swimmer.sex },
          best(row.meets, max.meets, row.starts ? row.meets : '–'),
          best(row.starts, max.starts, row.starts || '–'),
          best(row.swimmer.n, max.n, row.swimmer.n),
          best(row.swimmer.ges, max.ges, row.swimmer.ges),
          best(row.swimmer.avg, max.avg, row.swimmer.avg),
        ],
      }),
    ),
  ];
  return [title(heading), { type: 'table', style: 'rank', rows }];
}

/** The sheets "Auswertung Gesamt", "Auswertung Weiblich" and "Auswertung Männlich". */
export function reportParts(ev: Evaluation, year: string, list: Swimmer[]): ReportPart[] {
  const youth = ev.isYouth(year);
  const parts: ReportPart[] = [
    { name: 'Auswertung Gesamt', blocks: rankTable(ev, year, 'Gesamt', list) },
  ];
  for (const [word, sex] of [
    ['Weiblich', 'W'],
    ['Männlich', 'M'],
  ] as const) {
    const ofSex = list.filter((swimmer) => swimmer.sex === sex);
    if (!ofSex.length) continue;
    const blocks = rankTable(ev, year, word, ofSex);
    const young = ofSex.filter(youth);
    blocks.push(...rankTable(ev, year, 'Jugend', young));
    blocks.push(
      ...rankTable(
        ev,
        year,
        'Masters',
        ofSex.filter((swimmer) => !youth(swimmer)),
      ),
    );
    for (const group of ev.genderGroups(year, young, sex)) {
      blocks.push(
        ...rankTable(
          ev,
          year,
          group.label + (group.merged ? ' (zusammengelegt)' : ''),
          group.members,
        ),
      );
    }
    parts.push({ name: `Auswertung ${word}`, blocks });
  }
  return parts;
}

/** The ranking tables for one choice of "Wertung" on the ranking page. */
export function rankingBlocks(
  ev: Evaluation,
  year: string,
  list: Swimmer[],
  group: string,
): Block[] {
  if (group === 'Alle') return reportParts(ev, year, list).flatMap((part) => part.blocks);
  if (group === 'Weiblich' || group === 'Männlich') {
    const part = reportParts(ev, year, list).find((item) => item.name === `Auswertung ${group}`);
    return part?.blocks ?? [];
  }
  const youth = ev.isYouth(year);
  const chosen = group === 'Masters' ? list.filter((swimmer) => !youth(swimmer)) : list;
  return rankTable(ev, year, group, chosen);
}

/** The first three of each list, as handed to the general assembly. */
export function assemblyBlocks(ev: Evaluation, year: string, list: Swimmer[]): Block[] {
  const youth = list.filter(ev.isYouth(year));
  const women = (items: Swimmer[]) => items.filter((swimmer) => swimmer.sex === 'W');
  const men = (items: Swimmer[]) => items.filter((swimmer) => swimmer.sex === 'M');
  return [
    ...rankTable(ev, year, 'Auswertung Gesamt', list, 3),
    ...rankTable(ev, year, 'Weiblich Gesamt', women(list), 3),
    ...rankTable(ev, year, 'Weiblich Jugend', women(youth), 3),
    ...rankTable(ev, year, 'Männlich Gesamt', men(list), 3),
    ...rankTable(ev, year, 'Männlich Jugend', men(youth), 3),
  ];
}

function infoRows(rows: [string, string | number][]): Row[] {
  return rows.map(([label, value]) => ({
    cells: [
      { v: label, align: 'l', bold: true },
      { v: value, align: 'r' },
    ],
  }));
}

/** Members, groups and jubilees side by side (the sheet "Mitgliederstatistik"). */
export function memberBlocks(ev: Evaluation, year: string): Block[] {
  const stats = ev.memberStats(year);
  const left: Block[] = [
    title('Auswertung Mitgliederzahlen'),
    {
      type: 'table',
      style: 'info',
      rows: infoRows([
        ['Eintritte', stats.joined],
        ['Austritte', stats.left],
        [`Mitgliederzahl am 01.01.${stats.reference}`, stats.total],
      ]),
    },
    title('Gruppenauslastung'),
    stats.groups.length
      ? { type: 'table', style: 'info', rows: infoRows(stats.groups) }
      : { type: 'note', text: 'Noch keine Gruppen: Den Mitgliedern fehlt die Gruppe.' },
  ];
  const middle: Block[] = [
    title('Mitgliederstatistik'),
    {
      type: 'table',
      style: 'info',
      rows: infoRows([
        ['Weiblich', stats.women],
        ['Männlich', stats.men],
        ...(stats.other ? ([['Divers', stats.other]] as [string, number][]) : []),
        ['Gesamt', stats.total],
        ...stats.ages,
      ]),
    },
  ];
  const jubilees = stats.jubilees.filter((item) => item.names.length);
  const right: Block[] = [
    title(`Jubiläum ${year}`),
    {
      type: 'table',
      style: 'info',
      rows: [
        head(['Jahre', 'Name']),
        ...(jubilees.length
          ? jubilees.flatMap((item) =>
              item.names.map(
                (name): Row => ({
                  cells: [
                    { v: item.years, align: 'r' },
                    { v: name, align: 'l' },
                  ],
                }),
              ),
            )
          : [
              {
                cells: [
                  { v: '–', align: 'r' as const },
                  { v: '–', align: 'l' as const },
                ],
              },
            ]),
      ],
    },
  ];
  return [{ type: 'columns', columns: [left, middle, right] }];
}

/** Events, judges and places of the season (the sheet "Veranstaltungsstatistik"). */
export function statBlocks(ev: Evaluation, year: string): Block[] {
  const stat = ev.stat(year);
  if (!stat.count) {
    return [
      { type: 'note', text: `Für ${year} gibt es noch keine Veranstaltungen mit Ergebnissen.` },
    ];
  }
  const known = stat.events.filter((row) => row.fee !== null);
  const feeSum = known.reduce((sum, row) => sum + (row.fee ?? 0), 0);
  const events: Row[] = [
    {
      cells: [
        ...[
          'Datum',
          'Veranstaltung',
          'Ort',
          'Bahn',
          'Schwimmer',
          'Einzel',
          'Staffel',
          'Meldegeld',
        ].map((v): Cell => ({ v, head: true })),
        { v: 'Ändern', head: true, screen: true },
      ],
    },
    ...stat.events.map(
      (row): Row => ({
        cells: [
          { v: shortDate(row.d), align: 'r' },
          { v: row.title, align: 'l' },
          { v: row.place, align: 'l' },
          { v: row.pool, align: 'l' },
          { v: row.swimmers, align: 'r' },
          { v: row.singles, align: 'r' },
          { v: row.relays, align: 'r' },
          { v: money(row.fee), align: 'r' },
          {
            v: '',
            screen: true,
            action: { type: 'fee', id: row.id, manual: row.manual, value: row.fee },
          },
        ],
      }),
    ),
    {
      kind: 'total',
      cells: [
        {
          v: `Gesamt für ${stat.count} Veranstaltungen mit Ergebnissen`,
          align: 'l',
          bold: true,
          span: 4,
        },
        { v: stat.total.swimmers, align: 'r', bold: true },
        { v: stat.total.singles, align: 'r', bold: true },
        { v: stat.total.relays, align: 'r', bold: true },
        { v: known.length ? money(feeSum) : '–', align: 'r', bold: true },
        { v: '', screen: true },
      ],
    },
  ];
  const counted = stat.judges.filter((judge) => !judge.excluded);
  const judgeBlocks: Block[] = stat.judges.length
    ? [
        {
          type: 'table',
          style: 'judges',
          rows: [
            {
              cells: [
                ...['Kampfrichter', 'Stammverein', 'Veranstaltungen', 'Abschnitte'].map(
                  (v): Cell => ({ v, head: true }),
                ),
                { v: 'Wettkämpfe', head: true, screen: true },
                { v: 'Zählt', head: true, screen: true },
              ],
            },
            ...stat.judges.map(
              (judge): Row => ({
                screen: judge.excluded,
                dim: judge.excluded,
                cells: [
                  { v: judge.name, align: 'l' },
                  { v: judge.club, align: 'l' },
                  { v: judge.meets, align: 'r' },
                  { v: judge.sections, align: 'r' },
                  {
                    v: judge.events
                      .map(
                        (item) =>
                          `${shortDate(item.d)} ${item.title}${item.sections.length ? ` (Abschnitt ${item.sections.join(', ')})` : ''}`,
                      )
                      .join('; '),
                    align: 'l',
                    screen: true,
                  },
                  {
                    v: '',
                    screen: true,
                    action: { type: 'judge', name: judge.name, excluded: judge.excluded },
                  },
                ],
              }),
            ),
            {
              kind: 'total',
              cells: [
                { v: `Gesamt für ${counted.length} Kampfrichter`, align: 'l', bold: true, span: 2 },
                {
                  v: counted.reduce((sum, judge) => sum + judge.meets, 0),
                  align: 'r',
                  bold: true,
                },
                {
                  v: counted.reduce((sum, judge) => sum + judge.sections, 0),
                  align: 'r',
                  bold: true,
                },
                { v: '', screen: true },
                { v: '', screen: true },
              ],
            },
          ],
        },
      ]
    : [{ type: 'note', text: 'Bei den Veranstaltungen ist kein Kampfgericht eingetragen.' }];
  const placeTable = (label: string, counts: number[]): Block => ({
    type: 'table',
    style: 'places',
    rows: [
      head([label, 'Platzierung', 'Anzahl']),
      ...['Platz 1', 'Platz 2', 'Platz 3', 'Andere'].map(
        (name, index): Row => ({
          cells: [{ v: '' }, { v: name, align: 'l' }, { v: counts[index], align: 'r' }],
        }),
      ),
      {
        kind: 'total',
        cells: [
          { v: '' },
          { v: 'Gesamt', align: 'l', bold: true },
          { v: counts.reduce((sum, value) => sum + value, 0), align: 'r', bold: true },
        ],
      },
    ],
  });
  return [
    title(`Veranstaltungen, Saison ${year}`),
    { type: 'table', style: 'events', rows: events },
    title(`Kampfrichterstatistik, Saison ${year}`),
    ...judgeBlocks,
    title(`Ergebnisse, Saison ${year}`),
    placeTable('Einzelstarts', stat.places.singles),
    placeTable('Staffelstarts', stat.places.relays),
  ];
}

/** Jubilees, cups and medals (the sheet "Pokale und Medaillen" without the jubilees). */
export function honourBlocks(
  ev: Evaluation,
  year: string,
  list: Swimmer[],
  withJubilees: boolean,
): Block[] {
  const honours = ev.honours(year, list);
  const blocks: Block[] = [];
  if (withJubilees) {
    blocks.push(title(`Jubiläen ${year}`), {
      type: 'table',
      style: 'info',
      rows: [
        head(['Jahre', 'Name']),
        ...ev.memberStats(year).jubilees.flatMap((item) =>
          item.names.length
            ? item.names.map(
                (name): Row => ({
                  cells: [
                    { v: item.years, align: 'r' },
                    { v: name, align: 'l' },
                  ],
                }),
              )
            : [
                {
                  cells: [
                    { v: item.years, align: 'r' as const },
                    { v: '–', align: 'l' as const },
                  ],
                },
              ],
        ),
      ],
    });
  }
  blocks.push(title(`Pokale ${year}`), {
    type: 'table',
    style: 'info',
    rows: [
      head(['Pokal', 'Name', 'Jahrgang', 'Punkte']),
      ...(honours.cups.length
        ? honours.cups.map(
            (cup): Row => ({
              cells: [
                { v: cup.title, align: 'l' },
                { v: cup.swimmer.name, align: 'l' },
                { v: cup.swimmer.jg },
                { v: cup.swimmer.ges, align: 'r' },
              ],
            }),
          )
        : [{ cells: [{ v: 'Noch keine Punkte.', align: 'l' as const, span: 4 }] }]),
    ],
  });
  blocks.push(title(`Medaillen ${year}`), {
    type: 'table',
    style: 'medals',
    rows: [
      head(['Jahrgangsgruppe', 'Personen', 'Gold', 'Silber', 'Bronze']),
      ...honours.groups.map(
        (group): Row => ({
          cells: [
            { v: group.title + (group.merged ? ' (zusammengelegt)' : ''), align: 'l' },
            { v: group.members.length, align: 'r' },
            ...[0, 1, 2].map((index): Cell => ({ v: group.medals > index ? 1 : '–', align: 'r' })),
          ],
        }),
      ),
      {
        kind: 'total',
        cells: [
          { v: 'Insgesamt benötigt', align: 'l', bold: true },
          { v: '' },
          ...honours.totals.map((value): Cell => ({ v: value, align: 'r', bold: true })),
        ],
      },
    ],
  });
  blocks.push({
    type: 'note',
    text: `Bis 3 Personen in einer Gruppe gibt es nur Gold, bei 4 bis 5 auch Silber, ab 6 auch Bronze. Masters erhalten keine Medaille. Gruppen mit höchstens ${ev.mergeMax()} Person(en) sind je Geschlecht mit der kleineren Nachbargruppe zusammengelegt (Junioren ausgenommen).`,
  });
  for (const group of honours.groups) {
    if (!group.medals) continue;
    blocks.push(title(group.title + (group.merged ? ' (zusammengelegt)' : '')), {
      type: 'table',
      style: 'medals',
      rows: [
        head(['Medaille', 'Platz', 'Schwimmer', 'Jahrgang', 'Erreichte Punkte']),
        ...group.members.slice(0, group.medals).map(
          (swimmer, index): Row => ({
            cells: [
              { v: MEDALS[index], align: 'l' },
              { v: index + 1, align: 'r' },
              { v: swimmer.name, align: 'l' },
              { v: swimmer.jg },
              { v: swimmer.ges, align: 'r' },
            ],
          }),
        ),
      ],
    });
  }
  return blocks;
}

/** The honours page: medals and cups, then the overview for the general assembly. */
export function honourPage(ev: Evaluation, year: string, list: Swimmer[]): Block[] {
  return [
    ...honourBlocks(ev, year, list, true),
    title('Übersicht für die JHV', 1),
    ...assemblyBlocks(ev, year, list),
  ];
}

/** The sheet of one swimmer: every event with the times of the year, the best marked. */
export function sheetBlocks(ev: Evaluation, year: string, swimmer: Swimmer): Block[] {
  const starts = ev.starts(year)[swimmer.name.toLowerCase()] ?? [];
  const codes = Object.keys(swimmer.p);
  for (const start of starts) if (!codes.includes(start.k)) codes.push(start.k);
  codes.sort((a, b) => strokeSort(a) - strokeSort(b));
  const rows: Row[] = [
    {
      cells: [
        {
          v: `${swimmer.name}\u00a0\u00a0\u00a0 Jg. ${swimmer.jg}`,
          align: 'l',
          bold: true,
          span: 3,
        },
        { v: `Jahresauswertung ${year}`, align: 'r', bold: true, span: 3 },
      ],
    },
    head(['Datum', 'Ort', 'Bahntyp', 'Zeit', 'Differenz', 'World Aquatics']),
  ];
  for (const code of codes) {
    rows.push({
      kind: 'group',
      cells: [{ v: strokeLabel(code), align: 'l', bold: true, span: 6 }],
    });
    const own = starts.filter((start) => start.k === code);
    let bestTime: number | null = null;
    let bestPoints = 0;
    for (const start of own) {
      const ms = timeMs(start.t);
      if (ms !== null && (bestTime === null || ms < bestTime)) bestTime = ms;
      if ((start.points ?? 0) > bestPoints) bestPoints = start.points ?? 0;
    }
    for (const start of own) {
      const ms = timeMs(start.t);
      const fast = ms !== null && ms === bestTime;
      const top = (start.points ?? 0) > 0 && start.points === bestPoints;
      const diff =
        ms !== null && bestTime !== null && !fast ? sheetDiff(ms - bestTime) : '--:--,--';
      rows.push({
        cells: [
          { v: shortDate(start.d), align: 'r' },
          { v: start.place, align: 'l' },
          { v: start.b === 25 ? 'Kurzbahn' : start.b === 50 ? 'Langbahn' : '–', align: 'l' },
          { v: showTime(start.t) || start.t, align: 'r', bold: fast },
          { v: diff, align: 'l' },
          { v: (start.points ?? 0) > 0 ? (start.points ?? 0) : '', align: 'r', bold: top },
        ],
      });
    }
  }
  return [
    {
      type: 'sheet',
      blocks: [
        { type: 'table', style: 'sheet', rows },
        {
          type: 'sum',
          label: 'Summe der punktbesten Leistungen aller Strecken:',
          value: swimmer.ges,
          labelBold: false,
          valueBold: true,
        },
        {
          type: 'sum',
          label: 'Anzahl der gewerteten Strecken:',
          value: swimmer.n,
          labelBold: false,
          valueBold: false,
          small: true,
        },
        {
          type: 'sum',
          label: 'Durchschnittlich erreichte Punktzahl pro Strecke:',
          value: swimmer.avg,
          labelBold: true,
          valueBold: true,
        },
      ],
    },
  ];
}
