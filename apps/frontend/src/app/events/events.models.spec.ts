import {
  ChecklistPoint,
  categoriesOf,
  defaultOffset,
  dueFor,
  parseTemplateText,
  progressOf,
  stateOf,
  templateText,
} from './events.models';

describe('event templates', () => {
  it('reads one point per line with category and days', () => {
    const points = parseTemplateText(
      'Halle bestätigen | Vorher | -90\n\nAufbau | Am Tag\nAbbau|Danach|3\nSchild',
    );
    expect(points).toEqual([
      { text: 'Halle bestätigen', category: 'Vorher', offset: -90 },
      { text: 'Aufbau', category: 'Am Tag', offset: 0 },
      { text: 'Abbau', category: 'Danach', offset: 3 },
      { text: 'Schild', category: 'Vorher', offset: -7 },
    ]);
  });

  it('writes the points back the way they are read', () => {
    const text = 'Halle bestätigen | Vorher | -90\nAbbau | Danach | 3';
    expect(templateText(parseTemplateText(text))).toBe(text);
  });

  it('chooses a usual deadline for the phase when none is given', () => {
    expect(defaultOffset('Vorher')).toBe(-7);
    expect(defaultOffset('Am Tag')).toBe(0);
    expect(defaultOffset('Danach')).toBe(1);
    expect(defaultOffset('Verkauf')).toBe(-7);
  });

  it('counts the deadline from the date of the event, or leaves it open without a date', () => {
    expect(dueFor('2026-12-01', -30)).toBe('2026-11-01');
    expect(dueFor('2026-12-01', 2)).toBe('2026-12-03');
    expect(dueFor('', -3)).toBe('');
  });

  it('lists the categories in the order they first appear', () => {
    expect(categoriesOf([{ category: 'B' }, { category: 'A' }, { category: 'B' }])).toEqual([
      'B',
      'A',
    ]);
  });

  it('counts the points that are done', () => {
    const point = (done: boolean): ChecklistPoint => ({
      id: '',
      text: '',
      category: '',
      done,
      doneBy: '',
      due: '',
      who: [],
    });
    expect(progressOf([point(true), point(false), point(true)])).toEqual({ done: 2, total: 3 });
  });

  it('falls back to "Geplant" for an unknown state', () => {
    expect(stateOf('Läuft')).toBe('Läuft');
    expect(stateOf('irgendwas')).toBe('Geplant');
  });
});
