import { bandsToText, isDefaultBands, textToBands } from './band-text';
import { defaultBands } from './evaluation.logic';

describe('bandsToText and textToBands', () => {
  it('write the standard groups with open ends and read them back', () => {
    const bands = defaultBands('2026');
    const text = bandsToText(bands);
    expect(text.split('\n')[0]).toBe('Junior (Jg. 2008 und älter) | -2008');
    expect(text.split('\n')[1]).toBe('Jahrgang 2009 | 2009');
    expect(text.split('\n').at(-1)).toBe('Jahrgang 2019 und jünger | 2019-');
    expect(textToBands(text)).toEqual(bands);
    expect(isDefaultBands(textToBands(text), '2026')).toBe(true);
  });

  it('join several ranges with a plus and skip lines that make no sense', () => {
    const bands = textToBands(
      'Jahrgang 2012-2015 | 2012-2013 + 2014-2015\nohne Strich\n\nLeer | abc',
    );
    expect(bands).toEqual([
      {
        label: 'Jahrgang 2012-2015',
        ranges: [
          [2012, 2013],
          [2014, 2015],
        ],
        sex: '',
      },
    ]);
    expect(isDefaultBands(bands, '2026')).toBe(false);
    expect(bandsToText(bands)).toBe('Jahrgang 2012-2015 | 2012-2013 + 2014-2015');
  });
});
