import { BandDef } from './evaluation.model';
import { defaultBands } from './evaluation.logic';

/**
 * The groups of birth years as text, one group per line: `Name | 2012-2013 + 2015`. An open end
 * is written without a number: `Junior | -2008` and `Jahrgang 2019 und jünger | 2019-`.
 */
export function bandsToText(bands: readonly BandDef[]): string {
  return bands
    .map((band) => {
      const ranges = band.ranges
        .map(([from, to]) => (from === to ? String(from) : `${from || ''}-${to >= 9999 ? '' : to}`))
        .join(' + ');
      return `${band.label} | ${ranges}`;
    })
    .join('\n');
}

/** Reads the text of the group editor; lines that make no sense are left out. */
export function textToBands(text: string): BandDef[] {
  const out: BandDef[] = [];
  for (const line of text.split('\n')) {
    const match = /^\s*(.+?)\s*\|\s*([^|]*?)\s*(?:\|\s*[MWmw]\s*)?$/.exec(line);
    if (!match) continue;
    const ranges: [number, number][] = [];
    for (const part of match[2].split(/\s*[+,;]\s*/)) {
      const range = /^(\d{0,4})\s*(-\s*(\d{0,4}))?$/.exec(part);
      if (!range || (range[2] === undefined && !range[1])) continue;
      const from = range[1] ? Number(range[1]) : 0;
      const to = range[2] === undefined ? Number(range[1]) : range[3] ? Number(range[3]) : 9999;
      ranges.push([from, to]);
    }
    if (ranges.length) out.push({ label: match[1], ranges, sex: '' });
  }
  return out;
}

/** True when the groups are the standard ones of the year, so nothing needs to be stored. */
export function isDefaultBands(bands: readonly BandDef[], year: string): boolean {
  const standard = defaultBands(year);
  return (
    bands.length === standard.length &&
    bands.every(
      (band, index) =>
        band.label === standard[index].label &&
        JSON.stringify(band.ranges) === JSON.stringify(standard[index].ranges),
    )
  );
}
