import { TestBed } from '@angular/core/testing';
import { CompetitionStore } from './competition.store';

describe('CompetitionStore', () => {
  it('counts starts and fees of the invented sample meet', () => {
    const store = TestBed.inject(CompetitionStore);
    const meet = store.competition('c-1')!;
    const counts = store.counts(meet);
    expect(counts.swimmers).toBe(5);
    expect(counts.singles).toBe(11);
    expect(counts.relays).toBe(1);
    expect(store.totalFee(meet)).toBe(63);
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

  it('builds the entry downloads, the mail drafts and keeps sent mails', () => {
    const store = TestBed.inject(CompetitionStore);
    const meet = store.competition('c-1')!;
    const zip = store.entryDownload(meet, 'zip');
    expect(zip.name.endsWith('-SGBarnstorf-Me.zip')).toBe(true);
    expect(zip.bytes.length).toBeGreaterThan(200);
    expect(store.entryDownload(meet, 'dsv7').name.endsWith('.DSV7')).toBe(true);
    const { entryFile, control } = store.entryFiles(meet);
    expect(entryFile).toContain('STMELDUNG: 1;1001;JG;2012;0;;');
    expect(control).toContain('1. Mannschaft');
    const treasurer = store.treasurerMailDraft(meet);
    expect(treasurer.html).toContain('63,00 €');
    const entry = store.entryMailDraft(meet);
    expect(entry.to).toBe(meet.contactEmail);
    expect(entry.attachments).toEqual([zip.name]);
    store.sendMail(meet.id, entry);
    expect(store.outbox()).toHaveLength(1);
  });

  it('checks relay teams and only lets managers edit them', () => {
    const store = TestBed.inject(CompetitionStore);
    const meet = store.competition('c-1')!;
    const [team] = store.relaysOf('c-1');
    expect(store.relayIssues(meet, team)).toEqual([]);
    expect(store.relayIssues(meet, { ...team, memberIds: ['p-mats'] })[0]).toContain('4 Schwimmer');
    expect(store.canEditRelays()).toBe(store.canManage());
  });

  it('ticks the checklist, locks the entries and imports results', () => {
    const store = TestBed.inject(CompetitionStore);
    const meet = store.competition('c-2')!;
    expect(store.progress(meet).done).toBe(0);
    store.toggleStep('c-2', 'sent');
    expect(store.competition('c-2')!.sent).toBe(true);
    expect(store.progress(store.competition('c-2')!).done).toBe(1);
    store.setFeeStatus('c-2', 'paid');
    expect(store.progress(store.competition('c-2')!).done).toBe(2);

    store.importSchedule('c-1', {
      title: '',
      date: '',
      place: '',
      stand: '2026-11-20 18:30',
      starts: [
        { e: 1, l: 1, lt: 1, t: '10:05', b: 3, n: 'Muster, Anna', s: 'W', j: '2012', m: '' },
      ],
      duties: [{ a: 1, g: 'Zeitnehmer', pos: 'Zeitnehmer 1', name: 'N N' }],
      eventNames: { 1: '50 m Freistil weiblich' },
      clubs: {},
      warnings: [],
    });
    expect(store.openDuties(store.competition('c-1')!)).toBe(1);
    const outcome = store.importResults(
      'c-1',
      {
        title: '',
        place: '',
        found: [
          {
            e: 1,
            name: '',
            swimmer: 'Anna Muster',
            year: '2012',
            time: '00:40,00',
            splits: [],
            status: '',
            place: 2,
            ageGroup: '',
          },
        ],
        judges: [{ section: 1, name: 'Sabrina Landwehr', role: 'Zeitnehmer:in' }],
        relays: [],
        warnings: [],
      },
      false,
    );
    expect(outcome).toEqual({ matched: 1, added: 0 });
    const after = store.competition('c-1')!;
    expect(after.schedule.results['1-1-3'].place).toBe(2);
    expect(store.openDuties(after)).toBe(0);
    expect(after.plan.judges[1]).toBe(1);
  });
});
