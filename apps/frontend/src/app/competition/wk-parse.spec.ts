import { parseMeldeergebnis, parseResultsDsv7 } from './wk-parse';

const SCHEDULE = [
  'Meldeergebnis',
  'Beispiel-Schwimmfest',
  'am 05.12.2026 in Beispielstadt',
  'Veranstalter: Beispielverein',
  'Stand: 20.11.2026, 18:30',
  'Abschnitt 1 - Samstag 05.12.2026',
  'Einlass: 09:00 | Einschwimmen: 09:15 | Kampfrichtersitzung: 09:45',
  'Beginn: 10:00',
  'Kampfgericht Abschnitt 1',
  'Zeitnehmer',
  'Zeitnehmer 1   N N   SG Muster',
  'Zeitnehmer 2   N N   Anderer Verein',
  'Wettkampffolge für Abschnitt 1',
  'Wettkampf 1 - 50 m Freistil weiblich (2 Läufe)',
  'Lauf 1/2 - ca. 10:05 Uhr',
  'Bahn Schwimmer Jg Verein Meldezeit',
  'Bahn 3   Muster, Anna   2012   SG Muster   00:41,10',
  'Bahn 4   Beispiel, Berta   2011   Anderer Verein   00:39,00',
].join('\n');

describe('parseMeldeergebnis', () => {
  it('keeps the starts and judge slots of the club', () => {
    const parsed = parseMeldeergebnis(SCHEDULE.split('\n'), 'SG Muster');
    expect(parsed.title).toBe('Beispiel-Schwimmfest');
    expect(parsed.date).toBe('2026-12-05');
    expect(parsed.stand).toBe('2026-11-20 18:30');
    expect(parsed.starts).toEqual([
      {
        e: 1,
        l: 1,
        lt: 2,
        t: '10:05',
        b: 3,
        n: 'Muster, Anna',
        s: 'W',
        j: '2012',
        m: '00:41,10',
      },
    ]);
    expect(parsed.duties).toEqual([{ a: 1, g: 'Kampfgericht', pos: 'Zeitnehmer 1', name: 'N N' }]);
    expect(parsed.eventNames[1]).toBe('50 m Freistil weiblich');
  });

  it('warns when the club is not in the file', () => {
    const parsed = parseMeldeergebnis(SCHEDULE.split('\n'), 'Unbekannt');
    expect(parsed.starts).toHaveLength(0);
    expect(parsed.warnings.join(' ')).toContain('Unbekannt');
  });
});

describe('parseResultsDsv7', () => {
  const FILE = [
    'FORMAT: Wettkampfergebnisliste;7;',
    'VERANSTALTUNG: Beispiel-Schwimmfest;Beispielstadt;25;HANDZEIT;',
    'WETTKAMPF: 1;E;1;1;100;B;GL;W;SW;;;',
    'WERTUNG: 1;E;1006;JG;2013;2013;W;Jahrgang 2013;',
    'KAMPFGERICHT: 1;ZN;Landwehr, Sabrina;SG Muster;',
    'KAMPFGERICHT: 1;ZN;Fremd, Frieda;Anderer Verein;',
    'PNERGEBNIS: 1;E;1006;2;;Muster, Anna;111;47;W;2013;;SG Muster;3789;00:01:32,68;;;GER;;; (* Jahrgang 2013 *)',
    'PNERGEBNIS: 1;E;1006;1;;Fremd, Frieda;222;27;W;2013;;Anderer Verein;6443;00:01:31,39;;;GER;;;',
    'PNZWISCHENZEIT: 47;1;E;50;00:00:44,01;',
    'DATEIENDE',
  ].join('\r\n');

  it('takes only the club, with places, age group and splits', () => {
    const parsed = parseResultsDsv7(FILE, 'SG Muster');
    expect(parsed.found).toHaveLength(1);
    expect(parsed.found[0]).toMatchObject({
      e: 1,
      swimmer: 'Muster, Anna',
      time: '01:32,68',
      place: 2,
      ageGroup: 'Jahrgang 2013',
      splits: ['00:44,01'],
    });
    expect(parsed.judges).toEqual([
      { section: 1, name: 'Sabrina Landwehr', role: 'Zeitnehmer:in' },
    ]);
  });
});
