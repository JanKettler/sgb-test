import { parsePointListCsv } from './point-list';

const FILE = [
  'Punktbeste Leistung nach World Aquatics - Saison 2026',
  '',
  'Schwimmer;Jg;M/W;50F;100F;50S;Gesamt',
  'Anna Muster;2012;W;350;351;;701',
  'Emil Probe;2012;M;296;;;296',
].join('\n');

describe('parsePointListCsv', () => {
  it('reads the season, the events and the points of each swimmer', () => {
    const result = parsePointListCsv(FILE);
    expect(result.warnings).toEqual([]);
    expect(result.season).toBe('2026');
    expect(result.rows).toEqual([
      { name: 'Anna Muster', jg: 2012, sex: 'W', p: { '50F': 350, '100F': 351 }, ges: 701 },
      { name: 'Emil Probe', jg: 2012, sex: 'M', p: { '50F': 296 }, ges: 296 },
    ]);
  });

  it('warns about odd columns, years, sexes and totals instead of guessing', () => {
    const result = parsePointListCsv(
      [
        'Schwimmer;Jg;M/W;50F;Rekord;Gesamt',
        'Anna Muster;später;W;350;99;351',
        'Emil Probe;2012;X;296;;296',
      ].join('\n'),
    );
    expect(result.warnings).toEqual([
      'Unbekannte Spalte „Rekord“ wird ignoriert.',
      'Zeile 2 (Anna Muster): Jahrgang „später“ ist nicht lesbar.',
      'Anna Muster: Gesamt 351 passt nicht zur Summe der Strecken (350).',
      'Zeile 3 (Emil Probe): Geschlecht „X“ ist nicht M oder W.',
    ]);
    expect(result.rows).toHaveLength(2);
  });

  it('says so when the header line is missing', () => {
    const result = parsePointListCsv('Anna Muster;2012;W;350');
    expect(result.rows).toEqual([]);
    expect(result.warnings[0]).toContain(
      'Die Kopfzeile „Schwimmer;Jg;M/W;…“ wurde nicht gefunden.',
    );
  });

  it('ignores a byte order mark and blank lines', () => {
    const result = parsePointListCsv('\uFEFF\r\n' + FILE.replaceAll('\n', '\r\n\r\n'));
    expect(result.rows).toHaveLength(2);
  });
});
