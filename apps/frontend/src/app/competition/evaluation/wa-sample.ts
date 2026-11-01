import { WaSet, waDefaults, waKey, waSetId } from './wa-points';

/** File name shown for the example tables, so nobody mistakes them for the official ones. */
export const WA_SAMPLE_FILE = 'Beispielwerte (nicht amtlich)';

/**
 * Invented stand-ins for the base times of World Aquatics (the time for 1000 points, in
 * hundredths of a second): distance, stroke, men long course, women long course, men short course,
 * women short course. They only make the demo season show points. The real tables are read in on
 * the page "Hochladen".
 */
const BASE: readonly [number, string, number, number, number, number][] = [
  [50, 'FREE', 2091, 2361, 2016, 2283],
  [100, 'FREE', 4640, 5171, 4484, 4910],
  [200, 'FREE', 10200, 11223, 9937, 10710],
  [400, 'FREE', 22007, 23538, 21225, 22650],
  [50, 'BREAST', 2595, 2916, 2525, 2820],
  [100, 'BREAST', 5688, 6413, 5480, 6190],
  [200, 'BREAST', 12548, 13755, 11840, 13250],
  [50, 'BACK', 2355, 2686, 2211, 2505],
  [100, 'BACK', 5160, 5713, 4833, 5410],
  [200, 'BACK', 11192, 12314, 10443, 11640],
  [50, 'FLY', 2227, 2443, 2175, 2370],
  [100, 'FLY', 4945, 5548, 4710, 5230],
  [200, 'FLY', 11034, 12181, 10381, 11860],
  [100, 'MEDLEY', 0, 0, 4977, 5750],
  [200, 'MEDLEY', 11400, 12570, 10451, 12000],
  [400, 'MEDLEY', 24250, 26365, 22661, 25380],
];

/** The invented base time of an event in hundredths, or null where the table has none. */
export function sampleBase(
  pool: number,
  sex: 'M' | 'W',
  distance: number,
  stroke: string,
): number | null {
  const row = BASE.find((item) => item[0] === distance && item[1] === stroke);
  if (!row) return null;
  const [, , menLong, womenLong, menShort, womenShort] = row;
  const long = sex === 'M' ? menLong : womenLong;
  const short = sex === 'M' ? menShort : womenShort;
  const value = pool === 50 ? long : short;
  return value > 0 ? value : null;
}

/**
 * Example tables for the demo season: the long course table of the year and the short course
 * table that started in the autumn before.
 */
export function sampleWaSets(season: number, today: string): WaSet[] {
  const make = (course: 'LCM' | 'SCM', year: number): WaSet => {
    const range = waDefaults(course, year);
    const t: Record<string, number> = {};
    for (const [distance, stroke, menLong, womenLong, menShort, womenShort] of BASE) {
      const [men, women] = course === 'LCM' ? [menLong, womenLong] : [menShort, womenShort];
      if (men > 0) t[waKey('M', 1, distance, stroke)] = men;
      if (women > 0) t[waKey('F', 1, distance, stroke)] = women;
    }
    return {
      id: waSetId(course, String(year)),
      bahn: course === 'LCM' ? 'Lang' : 'Kurz',
      jahr: String(year),
      von: range.von,
      bis: range.bis,
      t,
      stand: today,
      file: WA_SAMPLE_FILE,
    };
  };
  return [make('SCM', season - 1), make('LCM', season)];
}
