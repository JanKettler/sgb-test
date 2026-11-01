import { resolutionsBook } from './executive-board.export';
import { emptyResolution } from './executive-board.models';

describe('board Excel list', () => {
  const entry = {
    ...emptyResolution('2026-11-02'),
    number: '2026/12',
    title: 'Hallenzeiten verlängern',
    who: ['Maria', 'Anna'],
    due: '2026-12-01',
    state: 'working' as const,
    text: 'Beim Betreiber anfragen.',
  };

  it('writes one row per decision with real dates and the state in words', () => {
    const book = resolutionsBook([entry], '2026-11-02');
    expect(book.title).toBe('Beschlussliste');
    expect(book.subtitle).toBe('Stand 02.11.2026');
    expect(book.sheets[0].rows).toEqual([
      [
        '2026/12',
        'Hallenzeiten verlängern',
        '02.11.2026',
        'Maria, Anna',
        '01.12.2026',
        'In Arbeit',
        'Beim Betreiber anfragen.',
      ],
    ]);
  });

  it('leaves the deadline empty when there is none', () => {
    const rows = resolutionsBook([{ ...entry, due: '' }], '2026-11-02').sheets[0].rows;
    expect(rows[0][4]).toBe('');
  });
});
