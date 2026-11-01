import { Competition, RunStart, emptyPlan, emptySchedule } from './competition.models';
import {
  byEvent,
  bySwimmer,
  byTime,
  germanDay,
  listFileName,
  listLines,
  meetSubtitle,
  overviewPage,
  plainEventName,
  sectionTimes,
  slipsBook,
  slipsPage,
  startListBook,
  startListPage,
} from './meet-lists';

const START = (
  e: number,
  l: number,
  lt: number,
  t: string,
  b: number,
  n: string,
  j: string,
  m = '',
) => ({ e, l, lt, t, b, n, s: '', j, m }) satisfies RunStart;

function meet(): Competition {
  const event = (no: number, section: number, distance: number, count = 1) =>
    ({
      no,
      section,
      count,
      distance,
      stroke: 'F',
      style: 'GL',
      sex: 'W',
      birthYears: 'offen',
      fee: 5,
    }) as const;
  return {
    id: 'm-1',
    title: 'Beispiel-Schwimmfest',
    place: 'Beispielstadt',
    pool: 25,
    timing: 'HANDZEIT',
    venueName: '',
    venueStreet: '',
    venueZip: '',
    venueCity: '',
    organiser: '',
    host: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    note: '',
    deadline: '2026-11-20',
    deadlineTime: '23:59',
    internalDeadline: '',
    open: true,
    groupIds: [],
    flatFee: 0,
    perSwimmerFee: 0,
    discount: 0,
    bank: { holder: '', bank: '', iban: '', bic: '' },
    sent: false,
    officials: {},
    coaches: {},
    plan: emptyPlan(),
    sections: [
      {
        no: 1,
        date: '2026-12-05',
        entry: '09:00',
        warmup: '00:00',
        judges: '09:30',
        start: '10:00',
        relative: false,
      },
      {
        no: 2,
        date: '2026-12-05',
        entry: '00:00',
        warmup: '00:00',
        judges: '00:00',
        start: '01:00',
        relative: true,
      },
    ],
    events: [event(1, 1, 50), event(2, 1, 200), event(3, 2, 50, 4)],
    schedule: {
      ...emptySchedule(),
      starts: [
        START(1, 2, 2, '10:12', 4, 'Muster, Anna', '2012', '00:41,10'),
        START(1, 1, 2, '9:55', 3, 'Beispiel, Berta', '2011'),
        START(2, 1, 1, '10:30', 2, 'Muster, Anna', '2012', '03:05,20'),
        START(3, 1, 1, '14:00', 5, '1. Mannschaft', 'Staffel'),
      ],
      duties: [
        { a: 1, g: 'Kampfgericht', pos: 'Zeitnehmer 1', name: 'N N' },
        { a: 2, g: 'Kampfgericht', pos: 'Zeitnehmer 1', name: 'Sabine Beispiel' },
      ],
      eventNames: { 1: '50m Freistil weiblich', 2: '200m Rücken weiblich', 3: '4x50m Lagen mixed' },
    },
  };
}

describe('lines of the lists', () => {
  it('carries the real time, heat and lane of every start', () => {
    const lines = listLines(meet());
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatchObject({
      section: 1,
      time: '10:12',
      event: 1,
      distance: '50m Freistil',
      heat: '2/2',
      lane: 4,
      swimmer: 'Anna Muster',
      year: '2012',
      entry: '41,10',
      key: '1-2-4',
    });
    expect(lines[1].entry).toBe('–');
    expect(lines[3]).toMatchObject({ section: 2, swimmer: '1. Mannschaft', year: 'Staffel' });
  });

  it('drops the sex from the event name', () => {
    expect(plainEventName('100m Brust weiblich')).toBe('100m Brust');
    expect(plainEventName('4x50m Lagen mixed')).toBe('4x50m Lagen');
    expect(plainEventName('200m TeamRace')).toBe('200m TeamRace');
  });

  it('sorts by event, by time of day and by swimmer', () => {
    const lines = listLines(meet());
    expect(byEvent(lines).map((line) => line.key)).toEqual(['1-1-3', '1-2-4', '2-1-2', '3-1-5']);
    // "9:55" comes before "10:12" although "9" sorts after "1" as text.
    expect(byTime(lines).map((line) => line.time)).toEqual(['9:55', '10:12', '10:30', '14:00']);
    expect(bySwimmer(lines).map((line) => `${line.swimmer}@${line.time}`)).toEqual([
      '1. Mannschaft@14:00',
      'Berta Beispiel@9:55',
      'Anna Muster@10:12',
      'Anna Muster@10:30',
    ]);
  });
});

describe('Excel books', () => {
  it('builds the run slips with heats and lanes, one section per page', () => {
    const book = slipsBook(meet(), 'event');
    expect(book.title).toBe('Laufzettel nach Wettkampffolge');
    expect(book.subtitle).toBe('Beispiel-Schwimmfest · Sa, 05.12.2026 · Beispielstadt');
    const [sheet] = book.sheets;
    expect(sheet.head).toEqual([
      'Abs.',
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
    ]);
    expect(sheet.rows[1]).toEqual([
      1,
      '10:12',
      1,
      '50m Freistil',
      '2/2',
      4,
      'Anna Muster',
      '2012',
      '41,10',
      '',
      '',
    ]);
    expect(sheet.breaksAfter).toEqual([2]);
    expect(sheet.orientation).toBe('landscape');
    expect(sheet.rowHeight).toBe(26);
  });

  it('lists the relay teams first when sorted by swimmer', () => {
    const [sheet] = slipsBook(meet(), 'swimmer').sheets;
    expect(sheet.rows[0].slice(0, 8)).toEqual([
      2,
      '14:00',
      3,
      '4x50m Lagen',
      '1/1',
      5,
      '1. Mannschaft',
      'Staffel',
    ]);
    expect(sheet.breaksAfter).toEqual([]);
  });

  it('builds the start list with the judges of the club', () => {
    const book = startListBook(meet());
    expect(book.sheets.map((sheet) => sheet.name)).toEqual(['Startliste', 'Kampfgericht']);
    expect(book.sheets[0].rows[0].slice(0, 3)).toEqual([1, '9:55', 'Berta Beispiel']);
    expect(book.sheets[1].rows).toEqual([
      [1, 'Zeitnehmer 1', 'Kampfgericht', 'noch offen'],
      [2, 'Zeitnehmer 1', 'Kampfgericht', 'Sabine Beispiel'],
    ]);
  });

  it('names the files and the days', () => {
    expect(listFileName('Laufzettel', meet())).toBe('Laufzettel_Beispiel_Schwimmfest.xlsx');
    expect(germanDay('2026-12-05')).toBe('Sa, 05.12.2026');
    expect(meetSubtitle({ ...meet(), place: '' })).toBe('Beispiel-Schwimmfest · Sa, 05.12.2026');
  });

  it('names the times of a section, without the empty ones', () => {
    const [first, second] = meet().sections;
    expect(sectionTimes(first)).toEqual([
      'Einlass 09:00',
      'Kampfrichtersitzung 09:30',
      'Beginn 10:00',
    ]);
    expect(sectionTimes(second)).toEqual([]);
  });
});

describe('print pages', () => {
  it('prints the run slips in landscape with one page per section', () => {
    const page = slipsPage(meet(), 'event');
    expect(page.landscape).toBe(true);
    expect(page.body.startsWith('<h1>Laufzettel nach Wettkampffolge</h1><div class="sub">')).toBe(
      true,
    );
    expect(page.body.match(/class="pb"/g)).toHaveLength(1);
    expect(page.body).toContain('<td class="mid">2/2</td>');
    expect(page.body).toContain('Endzeit');
  });

  it('prints the start list with the sections and the judges', () => {
    const page = startListPage(meet());
    expect(page.body).toContain('Abschnitt 2</td>');
    expect(page.body).toContain(
      'Abschnitt 1: Einlass 09:00 · Kampfrichtersitzung 09:30 · Beginn 10:00',
    );
    expect(page.body).toContain('<i>noch offen</i>');
  });

  it('prints one slip per swimmer and escapes the title', () => {
    const page = overviewPage({ ...meet(), title: 'Test & Co' });
    expect(page.body.match(/class="slip"/g)).toHaveLength(3);
    expect(page.body).toContain('Test &amp; Co');
    expect(page.body).toContain('10:12 Uhr · 50m Freistil · Lauf 2/2 · Bahn 4');
  });
});
