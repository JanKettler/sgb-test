import { createPeopleSample } from '../../people/people-sample';
import { createSampleData } from '../../training/sample-data';
import { pastSeason, seasonOf } from '../competition-sample';
import { dateOf, startKey } from '../competition.models';
import { Evaluation, defaultConfig } from './evaluation.logic';
import { sexByName, toEvalMeet, toEvalMember } from './evaluation.mapper';
import { createReportXlsx, evaluationFileName, evaluationSheets } from './evaluation.xlsx';
import { sampleWaSets } from './wa-sample';

const TODAY = '2026-11-01';
const people = createSampleData(TODAY).people;
const members = createPeopleSample(TODAY, people).members;

function evaluation(today = TODAY): Evaluation {
  const season = pastSeason(today, members);
  const sexes = sexByName(members);
  return new Evaluation({
    meets: season.competitions.map((meet) => toEvalMeet(meet, null, sexes)),
    members: members.map(toEvalMember),
    waSets: sampleWaSets(seasonOf(today), today),
    lists: [],
    config: defaultConfig(),
    clubName: 'SG Barnstorf',
    today,
    fees: {},
    excluded: [],
  });
}

describe('demo season', () => {
  const season = pastSeason(TODAY, members);

  it('has three closed meets of the year, with results for the club', () => {
    expect(
      season.competitions.map((meet) => [meet.id, dateOf(meet), meet.pool, meet.open]),
    ).toEqual([
      ['c-s1', '2026-03-14', 25, false],
      ['c-s2', '2026-05-16', 50, false],
      ['c-s3', '2026-06-27', 25, false],
    ]);
    for (const meet of season.competitions) {
      expect(meet.schedule.starts.length).toBeGreaterThan(10);
      const keys = meet.schedule.starts.map(startKey);
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of Object.keys(meet.schedule.results)) expect(keys).toContain(key);
    }
  });

  it('gives every result an entry and keeps the relay apart', () => {
    const first = season.competitions[0];
    const singles = first.schedule.starts.filter((start) => start.j !== 'Staffel');
    expect(season.entries.filter((entry) => entry.competitionId === 'c-s1')).toHaveLength(
      singles.length,
    );
    expect(season.relays.map((relay) => [relay.competitionId, relay.memberIds.length])).toEqual([
      ['c-s1', 4],
      ['c-s2', 4],
      ['c-s3', 4],
    ]);
    expect(first.schedule.relayResults).toHaveLength(1);
  });

  it('is the same every time and moves to last year early in the year', () => {
    expect(JSON.stringify(pastSeason(TODAY, members))).toBe(JSON.stringify(season));
    expect(seasonOf('2027-02-10')).toBe(2026);
    expect(seasonOf('2027-07-01')).toBe(2027);
    expect(dateOf(pastSeason('2027-02-10', members).competitions[0])).toBe('2026-03-14');
  });

  it('has one disqualification and one no-show', () => {
    const statuses = season.competitions.flatMap((meet) =>
      Object.values(meet.schedule.results).map((result) => result.status),
    );
    expect(statuses.filter((status) => status === 'DQ')).toHaveLength(1);
    expect(statuses.filter((status) => status === 'nicht angetreten')).toHaveLength(1);
  });
});

describe('demo season in the evaluation', () => {
  const ev = evaluation();

  it('ranks swimmers with sensible points and groups them', () => {
    expect(ev.years()).toEqual(['2026']);
    const list = ev.ranking('2026', 'best');
    expect(list.length).toBeGreaterThan(8);
    for (const swimmer of list) {
      expect(swimmer.ges).toBeGreaterThan(0);
      expect(['M', 'W']).toContain(swimmer.sex);
    }
    const best = Math.max(...list.map((swimmer) => swimmer.ges));
    expect(best).toBeGreaterThan(300);
    expect(ev.honours('2026', list).cups.length).toBeGreaterThan(1);
  });

  it('counts three meets, relays, places and judges', () => {
    const stat = ev.stat('2026');
    expect(stat.count).toBe(3);
    expect(stat.events.map((row) => row.pool)).toEqual(['Kurz', 'Lang', 'Kurz']);
    expect(stat.total.relays).toBe(3);
    expect(stat.places.relays).toEqual([0, 3, 0, 0]);
    expect(stat.judges.length).toBeGreaterThan(1);
    expect(stat.judges.every((judge) => judge.club === 'SG Barnstorf')).toBe(true);
  });

  it('only misses the fees of the meets, as no entry fees are typed in', () => {
    const lines = ev.missing('2026');
    expect(lines.some((line) => line.bold === 'Meldegeld fehlt bei:')).toBe(true);
    expect(lines.some((line) => line.text.includes('World-Aquatics-Tabelle'))).toBe(false);
  });
});

describe('demo season as Excel file', () => {
  const ev = evaluation();
  const sheets = evaluationSheets(ev, '2026');

  it('has the sheets of the Intranet export, then one sheet per swimmer', () => {
    expect(sheets.slice(0, 7).map((sheet) => sheet.name)).toEqual([
      'Auswertung Gesamt',
      'Auswertung Weiblich',
      'Auswertung Männlich',
      'Mitgliederstatistik',
      'Veranstaltungsstatistik',
      'Übersicht für JHV',
      'Pokale und Medaillen',
    ]);
    const swimmers = ev
      .ranking('2026', 'best')
      .map((swimmer) => swimmer.name)
      .sort((a, b) => a.localeCompare(b, 'de'));
    expect(sheets.slice(7).map((sheet) => sheet.name)).toEqual(swimmers);
  });

  it('puts the ranking first: title, header and one line per swimmer', () => {
    const rows = sheets[0].rows;
    expect(rows[0]).toEqual([{ v: 'Gesamt', s: 7 }]);
    expect(rows[1]?.map((cell) => cell?.v)).toEqual([
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
    // title, header, the swimmers and the blank line closing the table
    expect(rows.length).toBe(ev.ranking('2026', 'best').length + 3);
  });

  it('is named after the year and is a ZIP file', () => {
    expect(evaluationFileName('2026')).toBe('Jahresauswertung_2026.xlsx');
    const bytes = createReportXlsx(sheets);
    expect(bytes.length).toBeGreaterThan(5000);
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
  });
});
