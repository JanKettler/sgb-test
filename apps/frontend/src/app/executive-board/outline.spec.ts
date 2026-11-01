import { minutesFromAgenda, parseLetter, parseOutline, segmentsOf } from './outline';

describe('outline', () => {
  it('numbers the points and counts the sub points anew below every point', () => {
    const items = parseOutline('Begrüßung\nBeschlüsse\n- Trikots\n- Hallenzeiten\nVerschiedenes');
    const labels = items.map((item) => (item.kind === 'point' ? item.label : '|'));
    expect(labels).toEqual(['1.', '2.', 'a.', 'b.', '3.']);
  });

  it('indents sub points and counts roman numbers below them', () => {
    const items = parseOutline('Punkt\n- Unter\n-- Tief\n-- Tiefer\n- Wieder\n-- Von vorn');
    const flat = items.map((item) =>
      item.kind === 'point' ? `${item.level}${item.label}${item.text}` : '',
    );
    expect(flat).toEqual([
      '01.Punkt',
      '1a.Unter',
      '2i.Tief',
      '2ii.Tiefer',
      '1b.Wieder',
      '2i.Von vorn',
    ]);
  });

  it('collects lines with a pipe into one table and drops the separator line', () => {
    const items = parseOutline('| Angebot | Preis |\n| --- | --- |\n| A | 480 € |\n| B | 520 € |');
    expect(items).toEqual([
      {
        kind: 'table',
        rows: [
          ['Angebot', 'Preis'],
          ['A', '480 €'],
          ['B', '520 €'],
        ],
      },
    ]);
  });

  it('keeps blank lines out of the outline', () => {
    expect(parseOutline('\n\nEins\n\n\nZwei\n')).toHaveLength(2);
  });

  it('marks names in square brackets', () => {
    expect(segmentsOf('[Jonas] holt drei Angebote, [Anna] prüft')).toEqual([
      { text: 'Jonas', mark: true },
      { text: ' holt drei Angebote, ', mark: false },
      { text: 'Anna', mark: true },
      { text: ' prüft', mark: false },
    ]);
    expect(segmentsOf('ohne Namen')).toEqual([{ text: 'ohne Namen', mark: false }]);
  });

  it('reads a letter as paragraphs and tables', () => {
    const items = parseLetter(
      'Erster Absatz\nzweite Zeile\n\n| Posten | Summe |\n| Bahn | 72 € |\n\nSchluss',
    );
    expect(items.map((item) => item.kind)).toEqual(['point', 'table', 'point']);
    const first = items[0];
    expect(first.kind === 'point' && first.text).toBe('Erster Absatz\nzweite Zeile');
    expect(first.kind === 'point' && first.label).toBe('');
  });

  it('starts the minutes with one line per agenda item', () => {
    expect(minutesFromAgenda(['Begrüßung', 'Verschiedenes'])).toBe('Begrüßung\nVerschiedenes\n');
    expect(minutesFromAgenda([])).toBe('');
  });
});
