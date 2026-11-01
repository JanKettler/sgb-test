import { TestBed } from '@angular/core/testing';
import { addDays } from '../training/training-dates';
import { TrainingStore } from '../training/training.store';
import { periodIndex, periodTitle } from './billing.models';
import { BillingStore } from './billing.store';

function line() {
  return {
    id: '',
    date: '2026-06-01',
    time: '17:30',
    minutes: 60,
    group: 'Gruppe 1',
    place: 'Roshop',
  };
}

describe('BillingStore', () => {
  function create() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(BillingStore);
  }

  function asTrainer(store: BillingStore): void {
    TestBed.inject(TrainingStore).role.set('trainer');
    expect(store.me()).toBe('Jonas Weber');
  }

  describe('statements', () => {
    it('shows the own statements first, newest on top, and all of them to the board', () => {
      const store = create();
      expect(store.me()).toBe('Maria');
      expect(store.mine().map((entry) => entry.id)).toEqual(['s-4']);
      expect(store.everyone().map((entry) => entry.id)).toEqual(['s-4', 's-2', 's-3', 's-1']);
      asTrainer(store);
      expect(store.mine().map((entry) => entry.id)).toEqual(['s-2', 's-1']);
    });

    it('counts the drafts of the person and the statements that wait for payment', () => {
      const store = create();
      expect(store.draftCount()).toBe(1);
      expect(store.submittedCount()).toBe(1);
    });

    it('lets only the owner change a draft', () => {
      const store = create();
      const draft = (id: string) => store.statement(id);
      expect(store.canEdit(draft('s-4')!)).toBe(true);
      expect(store.canEdit(draft('s-2')!)).toBe(false);
      expect(store.canEdit(draft('s-3')!)).toBe(false);
      expect(store.canEdit(draft('s-1')!)).toBe(false);
    });

    it('starts a draft from the profile and the rates and puts it on top', () => {
      const store = create();
      asTrainer(store);
      const draft = store.create();
      expect(draft).toMatchObject({
        owner: 'Jonas Weber',
        name: 'Jonas Weber',
        state: 'draft',
        title: periodTitle(store.today),
        edv: '4711-12',
        license: 'Trainer C',
        rate: 13,
        kmRate: 0.3,
        iban: 'DE89 3704 0044 0532 0130 00',
        lines: [],
      });
      expect(store.mine()[0]?.id).toBe(draft.id);
    });

    it('takes the rate of the license for a person without a profile', () => {
      const store = create();
      const draft = store.create();
      expect(draft).toMatchObject({ owner: 'Maria', license: 'Trainer B', rate: 15, iban: '' });
    });

    it('keeps what was entered in the profile for the next statement', () => {
      const store = create();
      store.saveProfile('Maria', {
        edv: '99',
        license: 'Assistent',
        accountHolder: 'Maria Muster',
        iban: 'DE02 1203 0000 0000 2020 51',
        bic: 'BYLADEM1001',
      });
      expect(store.create()).toMatchObject({ edv: '99', rate: 8, accountHolder: 'Maria Muster' });
    });

    it('changes drafts only', () => {
      const store = create();
      store.update('s-3', { km: 5 });
      expect(store.statement('s-3')?.km).toBe(36);
      store.update('s-4', { km: 5, carText: 'Lehrgang' });
      expect(store.statement('s-4')).toMatchObject({ km: 5, carText: 'Lehrgang' });
      expect(store.mine()[0]?.id).toBe('s-4');
    });

    it('refuses to submit a statement without an amount', () => {
      const store = create();
      const draft = store.create();
      expect(store.setState(draft.id, 'submitted')).toBe('Die Abrechnung hat noch keinen Betrag.');
      expect(store.statement(draft.id)?.state).toBe('draft');
      expect(store.saveLine(draft.id, { ...line(), minutes: 60 })).toBe('');
      expect(store.setState(draft.id, 'submitted')).toBe('');
      expect(store.statement(draft.id)?.state).toBe('submitted');
    });

    it('writes down who paid and when, and forgets it when the statement is opened again', () => {
      const store = create();
      expect(store.setState('s-3', 'paid')).toBe('');
      expect(store.statement('s-3')).toMatchObject({
        state: 'paid',
        paidOn: store.today,
        paidBy: 'Maria',
      });
      store.setState('s-3', 'submitted');
      expect(store.statement('s-3')).toMatchObject({ state: 'submitted', paidOn: '', paidBy: '' });
    });

    it('removes drafts only', () => {
      const store = create();
      store.remove('s-3');
      expect(store.statement('s-3')).toBeDefined();
      store.remove('s-4');
      expect(store.statement('s-4')).toBeUndefined();
    });
  });

  describe('lines', () => {
    it('adds lines in order, changes them and removes them', () => {
      const store = create();
      const before = store.statement('s-4')!.lines.length;
      expect(store.saveLine('s-4', { ...line(), date: addDays(store.today, -20) })).toBe('');
      const lines = store.statement('s-4')!.lines;
      expect(lines).toHaveLength(before + 1);
      expect(lines[0]?.date).toBe(addDays(store.today, -20));
      expect(new Set(lines.map((entry) => entry.id)).size).toBe(lines.length);
      const first = lines[0]!;
      expect(store.saveLine('s-4', { ...first, minutes: 45 })).toBe('');
      expect(store.statement('s-4')!.lines[0]?.minutes).toBe(45);
      store.removeLine('s-4', first.id);
      expect(store.statement('s-4')!.lines).toHaveLength(before);
    });

    it('wants a date and minutes and refuses locked statements', () => {
      const store = create();
      expect(store.saveLine('s-4', { ...line(), date: '' })).toBe('Bitte ein Datum eintragen.');
      expect(store.saveLine('s-4', { ...line(), minutes: 0 })).toBe(
        'Die Minuten müssen größer als 0 sein.',
      );
      expect(store.saveLine('s-3', line())).toBe('Diese Abrechnung ist gesperrt.');
      store.removeLine('s-3', 'ln-30');
      expect(store.statement('s-3')!.lines).toHaveLength(4);
    });

    it('offers the training units of the trainer up to today that are on no statement', () => {
      const store = create();
      asTrainer(store);
      store.remove('s-2');
      const sessions = TestBed.inject(TrainingStore)
        .sessions()
        .filter((session) => session.trainerIds.includes('t-jonas') && session.date <= store.today)
        .sort((a, b) => a.date.localeCompare(b.date));
      const latest = sessions.at(-1)!;
      const draft = store.create();
      store.update(draft.id, { title: periodTitle(latest.date) });
      const candidates = store.candidateLines(store.statement(draft.id)!);
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.map((entry) => entry.date)).toContain(latest.date);
      for (const entry of candidates) {
        expect(entry.date <= store.today).toBe(true);
        expect(periodIndex(entry.date)).toBe(periodIndex(latest.date));
        expect(entry).toMatchObject({
          time: '17:30',
          minutes: 60,
          group: 'Gruppe 1, Gruppe 2',
          place: 'Hallenbad Roshop',
        });
      }
      expect(store.addLines(draft.id, candidates)).toBe(candidates.length);
      expect(store.statement(draft.id)!.lines).toHaveLength(candidates.length);
      expect(store.candidateLines(store.statement(draft.id)!)).toEqual([]);
    });

    it('offers nothing to a person who does not train', () => {
      const store = create();
      expect(store.candidateLines(store.statement('s-4')!)).toEqual([]);
    });

    it('does not add lines to a locked statement', () => {
      const store = create();
      expect(store.addLines('s-3', [line()])).toBe(0);
      expect(store.statement('s-3')!.lines).toHaveLength(4);
    });

    it('suggests groups and places that are known or used', () => {
      const store = create();
      expect(store.groupSuggestions()).toContain('Gruppe 1');
      expect(store.groupSuggestions()).toContain('Schwimmschule');
      expect(store.placeSuggestions()).toContain('Hallenbad Roshop');
    });
  });

  describe('drives', () => {
    it('lists the own drives, the newest first, and counts the open ones', () => {
      const store = create();
      expect(store.myDrives().map((drive) => drive.id)).toEqual(['f-7']);
      expect(store.openDriveCount()).toBe(1);
      expect(store.allOpenDriveCount()).toBe(5);
      asTrainer(store);
      expect(store.myDrives().map((drive) => drive.id)).toEqual(['f-2', 'f-1', 'f-3']);
      expect(store.openDriveCount()).toBe(2);
    });

    it('enters a drive with the flat fee and refuses a second one on the same day', () => {
      const store = create();
      expect(store.addDrive({ owner: 'Gast', date: store.today, note: ' Delfin ' })).toBe('');
      const drive = store.drives().find((entry) => entry.owner === 'Gast')!;
      expect(drive).toMatchObject({ amount: 6, state: 'open', note: 'Delfin' });
      expect(store.addDrive({ owner: 'gast', date: store.today, note: '' })).toBe(
        'Für diesen Tag gibt es schon eine Fahrt.',
      );
      expect(store.addDrive({ owner: ' ', date: store.today, note: '' })).toBe(
        'Bitte die Fahrerin oder den Fahrer wählen.',
      );
      expect(store.addDrive({ owner: 'Gast', date: '', note: '' })).toBe(
        'Bitte ein Datum eintragen.',
      );
    });

    it('uses the flat fee of the rates at the time of the entry', () => {
      const store = create();
      store.saveRates({ ...store.rates(), driveFee: 7.5 });
      store.addDrive({ owner: 'Gast', date: store.today, note: '' });
      expect(store.drives().find((entry) => entry.owner === 'Gast')?.amount).toBe(7.5);
    });

    it('changes and removes open drives only', () => {
      const store = create();
      const day = addDays(store.today, -30);
      expect(store.updateDrive('f-7', { date: day, note: 'Neu' })).toBe('');
      expect(store.drives().find((drive) => drive.id === 'f-7')).toMatchObject({
        date: day,
        note: 'Neu',
      });
      expect(store.updateDrive('f-7', { date: day, note: 'Noch einmal' })).toBe('');
      expect(store.updateDrive('f-6', { date: day, note: '' })).toBe(
        'Diese Fahrt ist schon eingereicht.',
      );
      store.removeDrive('f-6');
      expect(store.drives().some((drive) => drive.id === 'f-6')).toBe(true);
      store.removeDrive('f-7');
      expect(store.drives().some((drive) => drive.id === 'f-7')).toBe(false);
    });

    it('marks drives as submitted or settled and opens them again', () => {
      const store = create();
      store.setDriveState(['f-4', 'f-5'], 'settled');
      expect(store.drives().filter((drive) => drive.state === 'settled')).toHaveLength(3);
      expect(store.drives().find((drive) => drive.id === 'f-4')?.settledOn).toBe(store.today);
      store.setDriveState(['f-4'], 'open');
      expect(store.drives().find((drive) => drive.id === 'f-4')).toMatchObject({
        state: 'open',
        settledOn: '',
      });
    });

    it('lets the board change open drives of others, but nobody else', () => {
      const store = create();
      const drive = (id: string) => store.drives().find((entry) => entry.id === id)!;
      expect(store.canEditDrive(drive('f-4'))).toBe(true);
      expect(store.canEditDrive(drive('f-6'))).toBe(false);
      asTrainer(store);
      expect(store.canEditDrive(drive('f-1'))).toBe(true);
      expect(store.canEditDrive(drive('f-4'))).toBe(false);
    });

    it('offers the days of the competition training without a drive of the person', () => {
      const store = create();
      const sessions = TestBed.inject(TrainingStore)
        .sessions()
        .filter((session) => session.groupIds.includes('WK') && session.date <= store.today)
        .sort((a, b) => a.date.localeCompare(b.date));
      const latest = sessions.at(-1)!;
      const year = Number(latest.date.slice(0, 4));
      const period = periodIndex(latest.date);
      const days = store.candidateDrives('Gast', year, period);
      expect(days.map((day) => day.date)).toContain(latest.date);
      expect(new Set(days.map((day) => day.date)).size).toBe(days.length);
      for (const day of days) {
        expect(day.note).toMatch(/^Wettkampftraining, /);
        expect(day.date <= store.today).toBe(true);
        expect(periodIndex(day.date)).toBe(period);
      }
      expect(store.addDrive({ owner: 'Gast', ...days[0]! })).toBe('');
      expect(store.candidateDrives('Gast', year, period).map((day) => day.date)).not.toContain(
        days[0]!.date,
      );
    });

    it('offers the drivers of the rates, or every trainer when the list is empty', () => {
      const store = create();
      expect(store.driverNames()).toEqual([
        'Anna Brandt',
        'Jonas Weber',
        'Mira Köhler',
        'Tobias Lorenz',
      ]);
      store.saveRates({ ...store.rates(), drivers: [] });
      expect(store.driverNames()).toEqual(
        TestBed.inject(TrainingStore)
          .trainers()
          .map((trainer) => trainer.name),
      );
    });
  });
});
