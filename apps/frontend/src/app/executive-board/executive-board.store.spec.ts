import { TestBed } from '@angular/core/testing';
import { TrainingStore } from '../training/training.store';
import { addDays } from '../training/training-dates';
import { emptyMeeting, emptyMotion, emptyResolution } from './executive-board.models';
import { ExecutiveBoardStore } from './executive-board.store';

describe('ExecutiveBoardStore', () => {
  function create() {
    TestBed.resetTestingModule();
    return TestBed.inject(ExecutiveBoardStore);
  }

  it('lets only the board change anything', () => {
    const store = create();
    expect(store.canEdit()).toBe(true);
    TestBed.inject(TrainingStore).role.set('trainer');
    expect(store.canEdit()).toBe(false);
  });

  it('sorts the newest entries first', () => {
    const store = create();
    const dates = store.sortedMotions().map((entry) => entry.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('counts open and overdue decisions', () => {
    const store = create();
    expect(store.openCount()).toBe(2);
    expect(store.overdueCount()).toBe(1);
    store.markDone('b-1');
    expect(store.openCount()).toBe(1);
    expect(store.overdueCount()).toBe(0);
  });

  it('lists open decisions with a deadline and planned meetings by date', () => {
    const store = create();
    const list = store.deadlines();
    expect(list.map((entry) => entry.kind)).toEqual(['resolution', 'meeting', 'resolution']);
    expect(list[0]).toMatchObject({ id: 'b-1', overdue: true, days: -3, who: 'Jonas' });
    expect(list[1]).toMatchObject({ id: 's-1', overdue: false, days: 9 });
    expect(list[2]).toMatchObject({ id: 'b-2', days: 20, who: 'Maria, Anna' });
  });

  it('drops decisions that are done and meetings that took place from the deadlines', () => {
    const store = create();
    store.markDone('b-2');
    store.saveMeeting({ ...store.meetings()[0], state: 'Durchgeführt' });
    expect(store.deadlines().map((entry) => entry.id)).toEqual(['b-1']);
  });

  it('gives a new decision the next number of the year', () => {
    const store = create();
    const year = store.today.slice(0, 4);
    store.saveResolution({ ...emptyResolution(store.today), title: 'Neu' });
    const added = store.resolutions().find((entry) => entry.title === 'Neu');
    expect(store.nextNumber()).toBe(
      `${year}/${String(Number(added?.number.slice(5)) + 1).padStart(2, '0')}`,
    );
    expect(added?.number.startsWith(`${year}/`)).toBe(true);
  });

  it('keeps the number that was typed', () => {
    const store = create();
    store.saveResolution({ ...emptyResolution(store.today), title: 'Alt', number: '2019/03' });
    expect(store.resolutions().find((entry) => entry.title === 'Alt')?.number).toBe('2019/03');
  });

  it('makes a decision out of a passed motion, once', () => {
    const store = create();
    expect(store.hasResolution('a-2')).toBe(true);
    expect(store.resolutionFromMotion('a-2')).toBe(false);
    const motion = {
      ...emptyMotion(store.today, 'Jonas'),
      title: 'Neuer Antrag',
      state: 'Beschlossen' as const,
      decision: 'Wird gekauft.',
    };
    store.saveMotion(motion);
    const saved = store.motions().find((entry) => entry.title === 'Neuer Antrag');
    expect(saved?.id).toBeTruthy();
    expect(store.resolutionFromMotion(saved?.id ?? '')).toBe(true);
    const made = store.resolutions().find((entry) => entry.motionId === saved?.id);
    expect(made).toMatchObject({ title: 'Neuer Antrag', text: 'Wird gekauft.', state: 'open' });
    expect(store.hasResolution(saved?.id ?? '')).toBe(true);
  });

  it('starts minutes with the agenda but never overwrites existing minutes', () => {
    const store = create();
    store.prepareMinutes('s-1');
    expect(store.meetings().find((entry) => entry.id === 's-1')?.minutes).toBe(
      'Begrüßung\nWeihnachtsmarkt\nHallenzeiten\nVerschiedenes\n',
    );
    const before = store.meetings().find((entry) => entry.id === 's-2')?.minutes;
    store.prepareMinutes('s-2');
    expect(store.meetings().find((entry) => entry.id === 's-2')?.minutes).toBe(before);
  });

  it('adds and removes meetings and motions', () => {
    const store = create();
    store.saveMeeting({ ...emptyMeeting(addDays(store.today, 30)), title: 'Klausur' });
    expect(store.meetings()).toHaveLength(3);
    const added = store.meetings().find((entry) => entry.title === 'Klausur');
    store.removeMeeting(added?.id ?? '');
    expect(store.meetings()).toHaveLength(2);
    store.removeMotion('a-1');
    expect(store.motions().map((entry) => entry.id)).toEqual(['a-2']);
  });
});
