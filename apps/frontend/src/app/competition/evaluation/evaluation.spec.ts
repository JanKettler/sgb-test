import {
  assemblyBlocks,
  honourBlocks,
  rankTable,
  rankingBlocks,
  reportParts,
} from './evaluation.blocks';
import {
  Evaluation,
  defaultBands,
  defaultConfig,
  medalsFor,
  mergedLabel,
  sheetDiff,
  shortDate,
  streckeOf,
} from './evaluation.logic';
import { EvalInput, EvalMeet, EvalStart } from './evaluation.model';
import { WaSet } from './wa-points';

const start = (e: number, l: number, n: string, s: string, j: string): EvalStart => ({
  e,
  l,
  b: 1,
  n,
  s,
  j,
});

/** An invented season: one short course meet with results, one long course meet, one without. */
function meetOne(): EvalMeet {
  return {
    id: 'm1',
    title: 'Frühjahrsschwimmfest',
    place: 'Musterstadt',
    date: '2026-03-14',
    pool: 25,
    eventNames: {
      1: '50m Freistil weiblich',
      2: '100m Freistil weiblich',
      3: '50m Freistil männlich',
      4: '4x50m Freistil weiblich',
      5: '50m B-Beine weiblich',
    },
    eventDates: {},
    starts: [
      start(1, 1, 'Muster, Anna', 'W', '2012'),
      start(2, 1, 'Muster, Anna', 'W', '2012'),
      start(5, 1, 'Muster, Anna', 'W', '2012'),
      start(1, 2, 'Beispiel, Berta', 'W', '2012'),
      start(1, 3, 'Test, Clara', 'W', '2013'),
      start(1, 4, 'Probe, Dora', 'W', '2014'),
      start(1, 5, 'Demo, Eva', 'W', '2014'),
      start(1, 6, 'Jung, Jule', 'W', '2005'),
      start(1, 7, 'Alt, Gerda', 'W', '1990'),
      start(3, 1, 'Probe, Emil', 'M', '2012'),
      start(4, 1, '1. Mannschaft', 'W', 'Staffel'),
    ],
    results: {
      '1-1-1': { t: '00:31,20', place: 1, status: '' },
      '2-1-1': { t: '01:08,00', place: 2, status: '' },
      '1-2-1': { t: '00:33,00', place: 2, status: '' },
      '1-3-1': { t: '00:35,50', place: 5, status: '' },
      '1-4-1': { t: '00:34,00', place: 3, status: '' },
      '1-5-1': { t: '00:36,00', place: 6, status: '' },
      '1-6-1': { t: '00:32,00', place: 0, status: '' },
      '1-7-1': { t: '00:40,00', place: 0, status: '' },
      '3-1-1': { t: '00:30,00', place: 1, status: '' },
      '4-1-1': { t: '02:30,00', place: 2, status: '' },
    },
    relayPlaces: [],
    judges: [
      { name: 'Hans Richter', section: 1 },
      { name: 'Hans Richter', section: 2 },
      { name: 'Ida Zeit', section: 1 },
      { name: 'N N', section: 1 },
    ],
    fee: 54.5,
  };
}

function meetTwo(): EvalMeet {
  return {
    id: 'm2',
    title: 'Sommerpokal',
    place: 'Beispielstadt',
    date: '2026-06-20',
    pool: 50,
    eventNames: { 1: '50m Freistil weiblich' },
    eventDates: {},
    starts: [start(1, 1, 'Muster, Anna', 'W', '2012')],
    results: { '1-1-1': { t: '00:30,50', place: 1, status: '' } },
    relayPlaces: [],
    judges: [],
    fee: null,
  };
}

function meetThree(): EvalMeet {
  return {
    id: 'm3',
    title: 'Herbstmeeting',
    place: 'Ortsmitte',
    date: '2026-10-01',
    pool: 25,
    eventNames: {},
    eventDates: {},
    starts: [start(1, 1, 'Muster, Anna', 'W', '2012')],
    results: {},
    relayPlaces: [],
    judges: [],
    fee: null,
  };
}

const WA: WaSet[] = [
  {
    id: 'wa-kurz-2026',
    bahn: 'Kurz',
    jahr: '2026',
    von: '2026-01-01',
    bis: '2026-12-31',
    t: { 'M|1|50|FREE': 2000, 'F|1|50|FREE': 2200, 'F|1|100|FREE': 4800 },
    stand: '2026-01-02',
    file: 'kurz.csv',
  },
  {
    id: 'wa-lang-2026',
    bahn: 'Lang',
    jahr: '2026',
    von: '2026-01-01',
    bis: '2026-12-31',
    t: { 'F|1|50|FREE': 2300 },
    stand: '2026-01-02',
    file: 'lang.csv',
  },
];

function input(change: Partial<EvalInput> = {}): EvalInput {
  return {
    meets: [meetOne(), meetTwo(), meetThree()],
    members: [],
    waSets: WA,
    lists: [],
    config: defaultConfig(),
    clubName: 'SG Barnstorf',
    today: '2026-11-01',
    fees: {},
    excluded: [],
    ...change,
  };
}

describe('streckeOf', () => {
  it('reads distance and stroke from the event names', () => {
    expect(streckeOf('100m Brust weiblich')).toBe('100B');
    expect(streckeOf('Wettkampf 3 - 200m Lagen')).toBe('200L');
    expect(streckeOf('50 m Rücken')).toBe('50R');
    expect(streckeOf('50m Schmetterling männlich')).toBe('50S');
    expect(streckeOf('100m Kraul')).toBe('100F');
  });

  it('gives nothing for relays and for leg or arm drills', () => {
    expect(streckeOf('4x50m Freistil')).toBe('');
    expect(streckeOf('4 x 100 m Lagen')).toBe('');
    expect(streckeOf('50m B-Beine weiblich')).toBe('');
    expect(streckeOf('Wasserball')).toBe('');
  });
});

describe('small helpers', () => {
  it('formats dates, differences and labels', () => {
    expect(shortDate('2026-05-30')).toBe('30.05.26');
    expect(sheetDiff(1230)).toBe('+00:01,23');
    expect(sheetDiff(-520)).toBe('-00:00,52');
    expect(
      mergedLabel([
        [2012, 2012],
        [2013, 2013],
      ]),
    ).toBe('Jahrgang 2012–2013');
    expect(
      mergedLabel([
        [2019, 9999],
        [2018, 2018],
      ]),
    ).toBe('Jahrgang 2018 und jünger');
    expect(mergedLabel([[2012, 2012]])).toBe('Jahrgang 2012');
  });

  it('gives medals by the size of a group', () => {
    expect([0, 1, 3, 4, 5, 6, 12].map(medalsFor)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });

  it('builds the standard groups of a year', () => {
    const bands = defaultBands('2026');
    expect(bands[0].label).toBe('Junior (Jg. 2008 und älter)');
    expect(bands[1].label).toBe('Jahrgang 2009');
    expect(bands.at(-1)?.label).toBe('Jahrgang 2019 und jünger');
    expect(bands).toHaveLength(12);
  });
});

describe('Evaluation: starts and ranking', () => {
  const ev = new Evaluation(input());

  it('lists the years with results, newest first', () => {
    expect(ev.years()).toEqual(['2026']);
  });

  it('collects timed single starts with World Aquatics points', () => {
    const starts = ev.starts('2026')['anna muster'];
    expect(starts.map((item) => [item.k, item.t, item.points])).toEqual([
      ['50F', '00:31,20', 350],
      ['100F', '01:08,00', 351],
      ['50F', '00:30,50', 428],
    ]);
    expect(starts[0].place).toBe('Musterstadt');
    // The leg drill and the relay never become starts.
    expect(ev.starts('2026')['1. mannschaft']).toBeUndefined();
  });

  it('ranks by the sum of the best points per event', () => {
    const list = ev.ranking('2026', 'best');
    expect(list.map((swimmer) => [swimmer.name, swimmer.ges])).toEqual([
      ['Anna Muster', 779],
      ['Jule Jung', 324],
      ['Berta Beispiel', 296],
      ['Emil Probe', 296],
      ['Dora Probe', 270],
      ['Clara Test', 238],
      ['Eva Demo', 228],
      ['Gerda Alt', 166],
    ]);
    const anna = list[0];
    // 50F best of 350 (short course) and 428 (long course), plus 351 on the 100F.
    expect(anna.p).toEqual({ '50F': 428, '100F': 351 });
    expect(anna.n).toBe(2);
    expect(anna.avg).toBe(390);
  });

  it('counts one pool kind only when asked to', () => {
    const long = ev.ranking('2026', 'Lang');
    expect(long.map((swimmer) => [swimmer.name, swimmer.ges])).toEqual([['Anna Muster', 428]]);
    const short = ev.ranking('2026', 'Kurz');
    expect(short[0].ges).toBe(701);
  });

  it('adds points lists of the old club software to the ranking', () => {
    const withList = new Evaluation(
      input({
        lists: [
          {
            id: 'ps-2026-lang',
            jahr: '2026',
            bahn: 'Lang',
            rows: [{ name: 'Zora Alt', jg: 2010, sex: 'W', p: { '100B': 500 }, ges: 500 }],
            stand: '2026-02-01',
            file: 'liste.csv',
          },
        ],
      }),
    );
    const list = withList.ranking('2026', 'best');
    expect(list[0].name).toBe('Anna Muster');
    expect(list.find((swimmer) => swimmer.name === 'Zora Alt')?.ges).toBe(500);
  });
});

describe('Evaluation: groups, medals and honours', () => {
  const ev = new Evaluation(input());
  const list = ev.ranking('2026', 'best');

  it('merges a group of one person into the neighbour with fewer people', () => {
    const youthWomen = list.filter((s) => s.sex === 'W' && ev.isYouth('2026')(s));
    const groups = ev.genderGroups('2026', youthWomen, 'W');
    expect(groups.map((g) => [g.label, g.merged, g.members.length])).toEqual([
      ['Junior (Jg. 2008 und älter)', false, 1],
      ['Jahrgang 2012–2013', true, 3],
      ['Jahrgang 2014', false, 2],
    ]);
    expect(groups[1].members.map((s) => s.name)).toEqual([
      'Anna Muster',
      'Berta Beispiel',
      'Clara Test',
    ]);
  });

  it('does not merge when the limit is 0', () => {
    const none = new Evaluation(input({ config: { ...defaultConfig(), mergeMax: 0 } }));
    const youthWomen = list.filter((s) => s.sex === 'W' && ev.isYouth('2026')(s));
    expect(none.genderGroups('2026', youthWomen, 'W').map((g) => g.label)).toContain(
      'Jahrgang 2013',
    );
  });

  it('awards cups to the best and medals by group size', () => {
    const honours = ev.honours('2026', list);
    expect(honours.cups.map((cup) => [cup.title, cup.swimmer.name])).toEqual([
      ['Gesamt weiblich', 'Anna Muster'],
      ['Jugend weiblich', 'Anna Muster'],
      ['Gesamt männlich', 'Emil Probe'],
      ['Jugend männlich', 'Emil Probe'],
    ]);
    expect(honours.totals).toEqual([4, 0, 0]);
    expect(honours.groups.map((g) => [g.title, g.medals])).toEqual([
      ['Junior (Jg. 2008 und älter) weiblich', 1],
      ['Jahrgang 2012–2013 weiblich', 1],
      ['Jahrgang 2014 weiblich', 1],
      ['Jahrgang 2012 männlich', 1],
    ]);
  });
});

describe('Evaluation: statistic', () => {
  it('counts events, swimmers, starts, places and judges of the meets with results', () => {
    const ev = new Evaluation(input({ fees: { m2: 0 }, excluded: ['Ida Zeit'] }));
    const stat = ev.stat('2026');
    expect(stat.count).toBe(2);
    expect(
      stat.events.map((row) => [row.title, row.pool, row.swimmers, row.singles, row.relays]),
    ).toEqual([
      ['Frühjahrsschwimmfest', 'Kurz', 8, 9, 1],
      ['Sommerpokal', 'Lang', 1, 1, 0],
    ]);
    expect(stat.events[0].fee).toBe(54.5);
    expect(stat.events[1]).toMatchObject({ fee: 0, manual: true });
    expect(stat.total).toEqual({ swimmers: 9, singles: 10, relays: 1 });
    expect(stat.places.singles).toEqual([3, 2, 1, 4]);
    expect(stat.places.relays).toEqual([0, 1, 0, 0]);
    expect(stat.judges.map((j) => [j.name, j.meets, j.sections, j.excluded, j.club])).toEqual([
      ['Hans Richter', 1, 2, false, 'SG Barnstorf'],
      ['Ida Zeit', 1, 1, true, 'SG Barnstorf'],
    ]);
    expect(stat.judges[0].events).toEqual([
      { d: '2026-03-14', title: 'Frühjahrsschwimmfest', sections: [1, 2] },
    ]);
  });

  it('takes relay places from the protocol where the results hold none', () => {
    const meet = meetOne();
    meet.starts = meet.starts.filter((item) => item.j !== 'Staffel');
    meet.relayPlaces = [1, 3, 7];
    const stat = new Evaluation(input({ meets: [meet] })).stat('2026');
    expect(stat.places.relays).toEqual([1, 0, 1, 1]);
    expect(stat.events[0].relays).toBe(3);
  });

  it('says what is missing for a complete evaluation', () => {
    const ev = new Evaluation(input());
    const lines = ev.missing('2026').map((line) => `${line.bold} ${line.text}`);
    expect(lines[0]).toContain('Ergebnisse fehlen bei:');
    expect(lines[0]).toContain('Herbstmeeting (01.10.2026)');
    expect(lines.some((line) => line.includes('Meldegeld fehlt bei: Sommerpokal'))).toBe(true);
    const noTable = new Evaluation(input({ waSets: [] }))
      .missing('2026')
      .map((line) => line.text)
      .join('|');
    expect(noTable).toContain('keine World-Aquatics-Tabelle für Kurzbahn vorhanden');
    expect(noTable).toContain('keine World-Aquatics-Tabelle für Langbahn vorhanden');
  });

  it('names starts without a result and starts whose stroke is not recognised', () => {
    const plain = new Evaluation(input())
      .missing('2026')
      .map((line) => `${line.bold} ${line.text}`);
    const meetLine = plain.find((line) => line.startsWith('Frühjahrsschwimmfest'));
    expect(meetLine).toContain('(14.03.2026)');
    expect(meetLine).toContain('1 von 10 Starts ohne Ergebnis');
    const meet = meetOne();
    meet.results['5-1-1'] = { t: '00:50,00', place: 0, status: '' };
    const drill = new Evaluation(input({ meets: [meet] })).missing('2026').map((line) => line.text);
    expect(drill.join('|')).toContain('1 Starts mit nicht erkannter Strecke (Wettkampf-Nr. 5;');
    expect(drill.join('|')).toContain('„50m B-Beine weiblich“');
  });

  it('names the starts of a swimmer that are not on the sheet', () => {
    const ev = new Evaluation(input());
    expect(ev.swimmerGaps('2026', 'Anna Muster')).toEqual([
      'Frühjahrsschwimmfest (14.03.26): 1 ohne Ergebnis von 3 Starts',
      'Herbstmeeting (01.10.26): 1 ohne Ergebnis von 1 Starts',
    ]);
    const meet = meetOne();
    meet.results['5-1-1'] = { t: '00:50,00', place: 0, status: '' };
    const drill = new Evaluation(input({ meets: [meet] }));
    expect(drill.swimmerGaps('2026', 'Anna Muster')).toEqual([
      'Frühjahrsschwimmfest (14.03.26): 1 mit nicht erkannter Strecke von 3 Starts',
    ]);
  });

  it('counts a start with a status but no time as not started', () => {
    const meet = meetOne();
    meet.results['1-2-1'] = { t: '', place: 0, status: 'nicht angetreten' };
    const ev = new Evaluation(input({ meets: [meet] }));
    expect(ev.swimmerGaps('2026', 'Berta Beispiel')).toEqual([
      'Frühjahrsschwimmfest (14.03.26): 1 nicht angetreten von 1 Starts',
    ]);
  });

  it('warns when the base times are older than this year', () => {
    expect(new Evaluation(input()).waExpired()).toBeNull();
    const later = new Evaluation(input({ today: '2027-02-01' }));
    expect(later.waExpired()).toEqual({ last: 2026, current: 2027 });
    expect(later.waInfo()).toContain('Kurzbahn 2026 (gültig bis 31.12.2026, abgelaufen)');
  });
});

describe('Evaluation: members', () => {
  const members = [
    {
      name: 'Anna Muster',
      birthYear: 2012,
      sex: 'W',
      entry: '2016-09-01',
      exit: '',
      groups: ['Wettkampfgruppe'],
    },
    {
      name: 'Emil Probe',
      birthYear: 2012,
      sex: 'M',
      entry: '2026-02-01',
      exit: '',
      groups: ['Gruppe 2'],
    },
    {
      name: 'Gerda Alt',
      birthYear: 1976,
      sex: 'W',
      entry: '2001-01-01',
      exit: '',
      groups: ['Masters'],
    },
    {
      name: 'Hugo Weg',
      birthYear: 1990,
      sex: 'M',
      entry: '2000-01-01',
      exit: '2025-06-30',
      groups: [],
    },
    {
      name: 'Karl Gehtweg',
      birthYear: 1985,
      sex: 'M',
      entry: '2010-05-01',
      exit: '2026-03-31',
      groups: ['Masters'],
    },
  ];

  it('counts joins, leaves, members by sex and age and the jubilees', () => {
    const stats = new Evaluation(input({ members })).memberStats('2026');
    expect(stats.joined).toBe(1);
    expect(stats.left).toBe(1);
    // The numbers are for 1 January of the next year, so people who left in 2026 are gone.
    expect(stats.reference).toBe(2027);
    expect([stats.women, stats.men, stats.total]).toEqual([2, 1, 3]);
    expect(stats.ages.find(([label]) => label === '15-18 Jahre')?.[1]).toBe(2);
    expect(stats.ages.find(([label]) => label === 'über 40 Jahre')?.[1]).toBe(1);
    expect(stats.groups).toEqual([
      ['Wettkampfgruppe', 1],
      ['Gruppe 2', 1],
      ['Masters', 1],
    ]);
    expect(stats.jubilees.find((item) => item.years === 10)?.names).toEqual(['Anna Muster']);
    expect(stats.jubilees.find((item) => item.years === 25)?.names).toEqual(['Gerda Alt']);
    expect(stats.jubilees.find((item) => item.years === 40)?.names).toEqual([]);
  });

  it('knows nobody before the first member joined', () => {
    const stats = new Evaluation(input({ members })).memberStats('2000');
    expect(stats.total).toBe(1);
    expect(stats.joined).toBe(1);
  });
});

describe('blocks of the evaluation', () => {
  const ev = new Evaluation(input());
  const list = ev.ranking('2026', 'best');

  it('writes the ranking tables like the Intranet: total, women with youth, masters and groups', () => {
    const parts = reportParts(ev, '2026', list);
    expect(parts.map((part) => part.name)).toEqual([
      'Auswertung Gesamt',
      'Auswertung Weiblich',
      'Auswertung Männlich',
    ]);
    const titles = parts[1].blocks.flatMap((block) => (block.type === 'title' ? [block.text] : []));
    expect(titles).toEqual([
      'Weiblich',
      'Jugend',
      'Masters',
      'Junior (Jg. 2008 und älter)',
      'Jahrgang 2012–2013 (zusammengelegt)',
      'Jahrgang 2014',
    ]);
  });

  it('bolds the best value of each column and counts places from 1', () => {
    const blocks = rankTable(ev, '2026', 'Gesamt', list.slice(0, 3));
    const table = blocks[1];
    if (table.type !== 'table') throw new Error('table expected');
    expect(table.rows[0].cells.map((cell) => cell.v)).toEqual([
      'Platz',
      'Schwimmer',
      'Jahrgang',
      'M/W/D',
      'Veranstaltungen',
      'Starts',
      'Anzahl Strecken',
      'Erreichte Punkte',
      'Durchschnitt Punkte',
    ]);
    const first = table.rows[1].cells;
    expect(first.map((cell) => cell.v)).toEqual([1, 'Anna Muster', 2012, 'W', 2, 3, 2, 779, 390]);
    expect(first.map((cell) => !!cell.bold)).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
    const second = table.rows[2].cells;
    expect(second.map((cell) => cell.v)).toEqual([2, 'Jule Jung', 2005, 'W', 1, 1, 1, 324, 324]);
    expect(second.map((cell) => !!cell.bold)).toEqual(Array(9).fill(false));
  });

  it('cuts the overview for the general assembly to the first three', () => {
    const blocks = assemblyBlocks(ev, '2026', list);
    const tables = blocks.filter((block) => block.type === 'table');
    expect(tables).toHaveLength(5);
    const first = tables[0];
    if (first.type !== 'table') throw new Error('table expected');
    expect(first.rows).toHaveLength(4);
  });

  it('shows only the chosen group on the ranking page', () => {
    const masters = rankingBlocks(ev, '2026', list, 'Masters');
    expect(masters.filter((block) => block.type === 'title')).toHaveLength(1);
    const table = masters[1];
    if (table.type !== 'table') throw new Error('table expected');
    expect(table.rows.map((row) => row.cells[1].v)).toEqual(['Schwimmer', 'Gerda Alt']);
  });

  it('leaves the jubilees out of the sheet "Pokale und Medaillen"', () => {
    const without = honourBlocks(ev, '2026', list, false).flatMap((block) =>
      block.type === 'title' ? [block.text] : [],
    );
    expect(without[0]).toBe('Pokale 2026');
    expect(without).toContain('Medaillen 2026');
    const withJubilees = honourBlocks(ev, '2026', list, true).flatMap((block) =>
      block.type === 'title' ? [block.text] : [],
    );
    expect(withJubilees[0]).toBe('Jubiläen 2026');
  });
});
