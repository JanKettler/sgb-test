import { TestBed } from '@angular/core/testing';
import { headWidth } from '../competition/xlsx';
import { fullDate } from '../training/training-dates';
import { eventBook, eventFilename } from './events.export';
import { EventsStore } from './events.store';

describe('event Excel list', () => {
  function market() {
    TestBed.resetTestingModule();
    const found = TestBed.inject(EventsStore)
      .events()
      .find((entry) => entry.title === 'Weihnachtsmarkt');
    if (!found) throw new Error('no event');
    return found;
  }

  it('writes the checklist and the helpers on two sheets', () => {
    const plan = market();
    const book = eventBook(plan);
    expect(book.title).toBe('Weihnachtsmarkt');
    expect(book.subtitle).toBe(`${fullDate(plan.date)}, 15:00 Uhr · Marktplatz`);
    expect(book.sheets.map((sheet) => sheet.name)).toEqual(['Checkliste', 'Helfer']);
    const list = book.sheets[0];
    expect(list.rows).toHaveLength(21);
    expect(list.rows[0]).toEqual([
      'ja',
      'Standplatz bestätigen',
      'Vorher',
      '',
      fullDate(plan.checklist[0].due),
      'Maria',
    ]);
    expect(list.rows[5][0]).toBe('');
    expect(book.sheets[1].rows).toEqual([
      ['Anna Brandt', 'Aufbau'],
      ['Mats Hartmann', 'Verkauf'],
    ]);
  });

  it('leaves the helper sheet out when nobody signed up', () => {
    const book = eventBook({ ...market(), helpers: [] });
    expect(book.sheets).toHaveLength(1);
  });

  it('keeps every heading on one line', () => {
    for (const sheet of eventBook(market()).sheets) {
      expect(sheet.widths).toHaveLength(sheet.head.length);
      for (const head of sheet.head) expect(headWidth(head)).toBeGreaterThan(head.length);
    }
  });

  it('makes a file name without special characters', () => {
    expect(eventFilename({ ...market(), title: 'Schwimmfest (eigene Ausrichtung)' })).toBe(
      'Schwimmfest_eigene_Ausrichtung.xlsx',
    );
    expect(eventFilename({ ...market(), title: '???' })).toBe('Veranstaltung.xlsx');
  });
});
