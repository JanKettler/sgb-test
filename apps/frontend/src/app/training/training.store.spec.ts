import { TestBed } from '@angular/core/testing';
import { TrainingSession } from './training.models';
import { TrainingStore } from './training.store';
import { addDays, weekdayIndex } from './training-dates';

describe('TrainingStore', () => {
  let store: TrainingStore;

  const upcoming = () => store.sessions().find((item) => item.date >= store.today)!;

  /** The first week after the session in which the same session does not exist yet. */
  const nextFree = (source: TrainingSession) => {
    let date = addDays(source.date, 7);
    while (store.hasSession(date, source.time, source.groupIds)) date = addDays(date, 7);
    return date;
  };

  const days = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000;

  beforeEach(() => {
    store = TestBed.inject(TrainingStore);
  });

  it('creates sessions in the past and in the future', () => {
    const sessions = store.sessions();
    expect(sessions.some((session) => session.date < store.today)).toBe(true);
    expect(sessions.some((session) => session.date >= store.today)).toBe(true);
  });

  it('replaces an earlier answer when a person responds again', () => {
    const session = upcoming();
    store.respond(session.id, 'p-lena', 'swimmer', 'declined', 'Krank');
    expect(store.responseOf(session.id, 'p-lena', 'swimmer')?.reason).toBe('Krank');
    store.respond(session.id, 'p-lena', 'swimmer', 'registered');
    const response = store.responseOf(session.id, 'p-lena', 'swimmer');
    expect(response?.status).toBe('registered');
    expect(response?.reason).toBeUndefined();
  });

  it('takes the registration over into the attendance and lets the trainer override it', () => {
    // A session of another group, so Lena has no sample answer for it yet.
    const session = store
      .sessions()
      .find((item) => item.date >= store.today && !item.groupIds.includes('G2'))!;
    expect(store.stateOf(session, 'p-lena', 'swimmer')).toBe('missing');
    store.respond(session.id, 'p-lena', 'swimmer', 'registered');
    expect(store.stateOf(session, 'p-lena', 'swimmer')).toBe('present');
    store.setAttendance(session.id, 'p-lena', 'swimmer', 'missing');
    expect(store.stateOf(session, 'p-lena', 'swimmer')).toBe('missing');
    store.respond(session.id, 'p-lena', 'swimmer', 'declined', 'Schule');
    expect(store.stateOf(session, 'p-lena', 'swimmer')).toBe('excused');
    store.setAttendance(session.id, 'p-lena', 'swimmer', 'present');
    expect(store.stateOf(session, 'p-lena', 'swimmer')).toBe('present');
  });

  it('lists somebody who trains a session only once, as trainer', () => {
    const jonas = store.person('t-jonas')!;
    const session = { ...upcoming(), groupIds: ['WK' as const], trainerIds: ['t-anna'] };
    expect(store.roleIn(session, jonas)).toBe('swimmer');
    const withTrainer = { ...session, trainerIds: ['t-anna', 't-jonas'] };
    expect(store.roleIn(withTrainer, jonas)).toBe('trainer');
    expect(store.sessionSwimmers(withTrainer).some((p) => p.id === 't-jonas')).toBe(false);
  });

  it('expands a weekly series on the chosen weekdays', () => {
    const dates = store.repeatDates('2026-11-03', {
      rhythm: 'weekly',
      until: '2026-11-17',
      weekdays: [2, 4],
    });
    expect(dates).toEqual(['2026-11-03', '2026-11-05', '2026-11-10', '2026-11-12', '2026-11-17']);
  });

  it('expands a monthly series on the same day of the month', () => {
    const dates = store.repeatDates('2026-01-31', {
      rhythm: 'monthly',
      until: '2026-04-30',
      weekdays: [],
    });
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('saves a series with a shifted deadline for every date', () => {
    const base = store.emptySession();
    const before = store.sessions().length;
    const created = store.saveSession(base, { rhythm: 'weekly', until: base.date, weekdays: [] });
    expect(created).toBe(1);
    expect(store.sessions().length).toBe(before + 1);
  });

  it('leaves the training day of a copy empty and keeps the rest of the session', () => {
    const source = upcoming();
    const copy = store.copyOf(source);
    expect(copy.id).toBe('');
    expect(copy.date).toBe('');
    expect(copy.deadlineDate).toBe('');
    expect(copy.time).toBe(source.time);
    expect(copy.groupIds).toEqual(source.groupIds);
    expect(copy.venueId).toBe(source.venueId);
    expect(copy.maxSwimmers).toBe(source.maxSwimmers);
    expect(copy.deadlineTime).toBe(source.deadlineTime);
  });

  it('puts the deadline of a copy as far before the chosen day as in the original', () => {
    const source = upcoming();
    const date = addDays(source.date, 14);
    const deadline = store.copyDeadline(source, date);
    expect(days(date, deadline)).toBe(days(source.date, source.deadlineDate));
    expect(store.copyDeadline(source, '')).toBe('');
  });

  it('leaves people who were added for one session out of the copy', () => {
    const source = upcoming();
    const regular = store.trainersForGroups(source.groupIds).map((trainer) => trainer.id);
    const guest = store.people().find((person) => !regular.includes(person.id))!.id;
    const copy = store.copyOf({
      ...source,
      trainerIds: [...regular, guest],
      extraSwimmerIds: [guest],
    });
    expect(copy.trainerIds).toEqual(regular);
    expect(copy.extraSwimmerIds).toEqual([]);
  });

  it('does not create a session twice', () => {
    const source = upcoming();
    const date = nextFree(source);
    const copy = { ...store.copyOf(source), date, deadlineDate: store.copyDeadline(source, date) };
    const first = store.addSessions(copy, null);
    expect(first.ids.length).toBe(1);
    expect(first.existing).toBe(0);
    expect(store.addSessions(copy, null)).toEqual({ ids: [], existing: 1 });
  });

  it('creates only the missing dates of a series', () => {
    const source = upcoming();
    const free = nextFree(source);
    const result = store.addSessions(
      { ...source, id: '' },
      { rhythm: 'weekly', until: free, weekdays: [weekdayIndex(source.date)] },
    );
    expect(result.ids.length).toBe(1);
    expect(result.existing).toBeGreaterThan(0);
    expect(store.findSession(result.ids[0])?.date).toBe(free);
  });

  it('reports a swimmer who missed the latest sessions in a row', () => {
    const finn = store.person('p-finn')!;
    expect(store.missingStreak(finn).count).toBeGreaterThanOrEqual(3);
    expect(store.actionNeeded().inactive.some((entry) => entry.person.id === 'p-finn')).toBe(true);
  });

  it('refuses to delete a venue that is still in use', () => {
    expect(store.deleteVenue('v-roshop')).toBe(false);
    store.addVenue('Testbad');
    const added = store.venues().find((venue) => venue.name === 'Testbad')!;
    expect(store.deleteVenue(added.id)).toBe(true);
  });

  it('lists the attendance with one row per swimmer and one column per session', () => {
    // A range, not just today: on days without a session the header has no date columns.
    const table = store.attendanceTable('WK', 'blank', store.today, addDays(store.today, 14));
    expect(table.head[0]).toBe('Name');
    expect(table.rows).toHaveLength(store.swimmers().filter((p) => p.groupId === 'WK').length);
    for (const row of table.rows) {
      expect(row).toHaveLength(table.head.length);
      expect(row.slice(1).every((cell) => cell === '')).toBe(true);
    }
  });
});
