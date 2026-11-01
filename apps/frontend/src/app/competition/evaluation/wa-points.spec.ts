import {
  WaSet,
  mergeWa,
  parseWaCsv,
  parseWaPdf,
  parseWaTime,
  pickWaSet,
  toWaSet,
  waDefaults,
  waPoints,
} from './wa-points';

function set(bahn: 'Kurz' | 'Lang', jahr: string, von: string, bis: string, t: WaSet['t']): WaSet {
  return { id: `wa-${bahn}-${jahr}`, bahn, jahr, von, bis, t, stand: '2026-01-02', file: 'x.csv' };
}

const SHORT = set('Kurz', '2026', '2026-01-01', '2026-12-31', {
  'M|1|50|FREE': 2000,
  'F|1|50|FREE': 2200,
  'F|1|100|FREE': 4800,
});

describe('parseWaTime', () => {
  it('reads minutes and seconds with a dot or a comma', () => {
    expect(parseWaTime('1:38.61')).toBe(9861);
    expect(parseWaTime('01:38,61')).toBe(9861);
    expect(parseWaTime('19.90')).toBe(1990);
    expect(parseWaTime('abc')).toBeNull();
  });
});

describe('waPoints', () => {
  it('gives 1000 points for the base time and floors the rest', () => {
    expect(waPoints([SHORT], 'M', 'Kurz', '50F', '2026-03-14', 20000)).toBe(1000);
    expect(waPoints([SHORT], 'M', 'Kurz', '50F', '2026-03-14', 40000)).toBe(125);
    expect(waPoints([SHORT], 'W', 'Kurz', '50F', '2026-03-14', 31200)).toBe(350);
  });

  it('knows no points without a table, a base time or a known sex', () => {
    expect(waPoints([SHORT], 'M', 'Lang', '50F', '2026-03-14', 30000)).toBeNull();
    expect(waPoints([SHORT], 'M', 'Kurz', '50S', '2026-03-14', 30000)).toBeNull();
    expect(waPoints([SHORT], '', 'Kurz', '50F', '2026-03-14', 30000)).toBeNull();
    expect(waPoints([SHORT], 'M', 'Kurz', '50F', '2026-03-14', 0)).toBeNull();
  });

  it('scores 25 m events as half of the doubled 50 m event', () => {
    // 15,00 s over 25 m is 30,00 s over 50 m: 394 points, half of it rounded is 197.
    expect(waPoints([SHORT], 'W', 'Kurz', '25F', '2026-03-14', 15000)).toBe(197);
  });
});

describe('pickWaSet', () => {
  const old = set('Kurz', '2025', '2025-09-01', '2026-08-31', {});
  const next = set('Kurz', '2026', '2026-09-01', '2027-08-31', {});

  it('takes the table that is valid on the day of the meet', () => {
    expect(pickWaSet([old, next], 'Kurz', '2026-03-14')?.jahr).toBe('2025');
    expect(pickWaSet([old, next], 'Kurz', '2026-10-01')?.jahr).toBe('2026');
  });

  it('falls back to the table of the year, then to the nearest one', () => {
    expect(pickWaSet([next], 'Kurz', '2026-03-14')?.jahr).toBe('2026');
    expect(pickWaSet([old], 'Kurz', '2030-01-01')?.jahr).toBe('2025');
    expect(pickWaSet([old], 'Lang', '2026-03-14')).toBeNull();
  });
});

describe('parseWaCsv', () => {
  it('reads the rows of a file and sets the usual validity', () => {
    const result = parseWaCsv(
      [
        '2026;SCM;M;1;50;FREE;20.00',
        '2026;SCM;F;1;50;FREE;22.00;22,00',
        '2026;LCM;M;1;50;FREE;21.00',
      ].join('\n'),
    );
    expect(result.errors).toEqual([]);
    expect(result.list.map((item) => item.id)).toEqual(['LCM-2026', 'SCM-2026']);
    const short = result.list[1];
    expect(short.t['M|1|50|FREE']).toBe(2000);
    expect(short.t['F|1|50|FREE']).toBe(2200);
    expect(short.von).toBe('2026-09-01');
    expect(short.bis).toBe('2027-08-31');
    expect(result.list[0].von).toBe('2026-01-01');
  });

  it('reports bad rows instead of guessing', () => {
    const result = parseWaCsv(
      [
        '2026;XXX;M;1;50;FREE;20.00',
        '2026;SCM;Q;1;50;FREE;20.00',
        '2026;SCM;M;9;50;FREE;20.00',
        '2026;SCM;M;1;50;HAHN;20.00',
        '2026;SCM;M;1;50;FREE;zwanzig',
        '2026;SCM;M;1;50;FREE;20.00;19,00',
        '2026;SCM;M;1;50;FREE;20.00',
        '2026;SCM;M;1;50;FREE;20.00',
        'ohne;Jahr',
        '2026;SCM',
      ].join('\n'),
    );
    expect(result.errors).toHaveLength(9);
    expect(result.errors[0]).toContain('Bahn „XXX“');
    expect(result.errors).toContain('Zeile 5: Zeit „zwanzig“ ist nicht lesbar.');
    expect(result.errors).toContain('Zeile 8: M 1 50 FREE kommt doppelt vor.');
  });

  it('warns about incomplete tables', () => {
    const result = parseWaCsv('2026;SCM;M;1;50;FREE;20.00');
    expect(result.warnings).toContain('Kurzbahn 2026: für Männer nur 1 von 18 Einzelstrecken.');
    expect(result.warnings).toContain('Kurzbahn 2026: keine Einzelstrecken für Frauen.');
  });
});

describe('parseWaPdf', () => {
  const times = (count: number) =>
    Array.from({ length: count }, (_, index) => `${20 + index}.${String(10 + index)}`).join(' ');

  it('reads the row for 1000 points of a table', () => {
    const lines = [
      'Point Scoring 2026 - Short Course',
      'Women Individual',
      'Validity - (01/09/2026 - 31/08/2027)',
      `1000 ${times(18)} 1000`,
    ];
    const result = parseWaPdf(lines, 'frauen.pdf');
    expect(result.errors).toEqual([]);
    const only = result.list[0];
    expect(only.id).toBe('SCM-2026');
    expect(only.von).toBe('2026-09-01');
    expect(only.bis).toBe('2027-08-31');
    expect(only.t['F|1|50|FREE']).toBe(2010);
    expect(only.t['F|1|100|MEDLEY']).toBeGreaterThan(0);
    expect(only.count).toBe(18);
  });

  it('refuses files that are no points table or have the wrong number of times', () => {
    expect(parseWaPdf(['Einladung'], 'a.pdf').errors).toEqual([
      'a.pdf ist keine World-Aquatics-Punktetabelle.',
    ]);
    const wrong = parseWaPdf(
      ['Point Scoring 2026 - Long Course', 'Men Individual', `1000 ${times(5)} 1000`],
      'b.pdf',
    );
    expect(wrong.errors).toEqual([
      'b.pdf: 5 Zeiten in der 1000-Punkte-Zeile gefunden, erwartet waren 17.',
    ]);
  });
});

describe('mergeWa and toWaSet', () => {
  it('puts several files together and flags two different times for one event', () => {
    const a = parseWaCsv('2026;SCM;M;1;50;FREE;20.00');
    const b = parseWaCsv('2026;SCM;F;1;50;FREE;22.00');
    const merged = mergeWa([a, b]);
    expect(merged.errors).toEqual([]);
    expect(merged.list).toHaveLength(1);
    expect(Object.keys(merged.list[0].t)).toEqual(['M|1|50|FREE', 'F|1|50|FREE']);
    const clash = mergeWa([a, parseWaCsv('2026;SCM;M;1;50;FREE;20.50')]);
    expect(clash.errors).toHaveLength(1);
    expect(clash.errors[0]).toContain('Widerspruch bei Kurzbahn 2026');
  });

  it('stores a table with its id and validity', () => {
    const read = parseWaCsv('2026;LCM;M;1;50;FREE;21.00').list[0];
    const range = waDefaults('LCM', 2026);
    const stored = toWaSet(read, range.von, range.bis, '2026-11-01', 'a.csv');
    expect(stored.id).toBe('wa-lcm-2026');
    expect(stored.bahn).toBe('Lang');
    expect(stored.stand).toBe('2026-11-01');
  });
});
