import { TestBed } from '@angular/core/testing';
import { CompetitionStore } from './competition.store';

describe('CompetitionStore', () => {
  it('counts starts and fees of the invented sample meet', () => {
    const store = TestBed.inject(CompetitionStore);
    const meet = store.competition('c-1')!;
    const counts = store.counts(meet);
    expect(counts.swimmers).toBe(5);
    expect(counts.singles).toBe(11);
    expect(store.totalFee(meet)).toBe(55);
    expect(store.feeOf(meet, 'p-mats')).toBe(15);
  });

  it('replaces the starts of a swimmer and removes them from the meet when empty', () => {
    const store = TestBed.inject(CompetitionStore);
    store.setEntries('c-1', 'p-felix', [{ eventNo: 1, time: '00:32,00' }]);
    expect(store.entriesOf('c-1', 'p-felix')).toHaveLength(1);
    store.setEntries('c-1', 'p-felix', []);
    expect(store.entriesOf('c-1', 'p-felix')).toHaveLength(0);
  });

  it('removes the starts when somebody declines', () => {
    const store = TestBed.inject(CompetitionStore);
    store.setDeclined('c-1', 'p-mats', true);
    expect(store.isDeclined('c-1', 'p-mats')).toBe(true);
    expect(store.entriesOf('c-1', 'p-mats')).toHaveLength(0);
  });

  it('only shows released meets, and group meets only to that group', () => {
    const store = TestBed.inject(CompetitionStore);
    const ids = store.visibleFor('p-lena').map((meet) => meet.id);
    expect(ids).toEqual(['c-1']);
  });

  it('flags missing certificate and wrong birth year', () => {
    const store = TestBed.inject(CompetitionStore);
    const meet = { ...store.competition('c-1')! };
    meet.events = meet.events.map((event) => ({ ...event, birthYears: '1900' }));
    store.save(meet);
    const issues = store.issuesOf(meet, 'p-mats');
    expect(issues.some((text) => text.startsWith('Jahrgang'))).toBe(true);
  });

  it('builds the entry ZIP and the treasurer text', () => {
    const store = TestBed.inject(CompetitionStore);
    const meet = store.competition('c-1')!;
    const { name, bytes } = store.entryZip(meet);
    expect(name.endsWith('-SGBarnstorf-Me.zip')).toBe(true);
    expect(bytes.length).toBeGreaterThan(200);
    expect(store.treasurerText(meet)).toContain('Bitte überweise 55,00 €');
  });
});
