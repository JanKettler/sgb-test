import { TestBed } from '@angular/core/testing';
import { TrainingStore } from './training.store';
import { addDays, weekdayIndex } from './training-dates';

describe('TrainingStore', () => {
  let store: TrainingStore;

  const upcoming = () => store.sessions().find((item) => item.date >= store.today)!;

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

  it('proposes the next week without the session for a copy and keeps the deadline distance', () => {
    const source = upcoming();
    const copy = store.copyOf(source);
    expect(copy.id).toBe('');
    expect(weekdayIndex(copy.date)).toBe(weekdayIndex(source.date));
    expect(store.hasSession(copy.date, copy.time, copy.groupIds)).toBe(false);
    // Every week in between already has the session, so the copy skips them.
    for (let date = addDays(source.date, 7); date < copy.date; date = addDays(date, 7)) {
      expect(store.hasSession(date, source.time, source.groupIds)).toBe(true);
    }
    const days = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000;
    expect(days(copy.date, copy.deadlineDate)).toBe(days(source.date, source.deadlineDate));
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
    const copy = store.copyOf(upcoming());
    const first = store.addSessions(copy, null);
    expect(first.ids.length).toBe(1);
    expect(first.existing).toBe(0);
    expect(store.addSessions(copy, null)).toEqual({ ids: [], existing: 1 });
  });

  it('creates only the missing dates of a series', () => {
    const source = upcoming();
    const free = store.copyOf(source).date;
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

  it('exports a semicolon separated list with one row per swimmer', () => {
    // A range, not just today: on days without a session the header has no date columns.
    const csv = store.attendanceCsv('WK', 'blank', store.today, addDays(store.today, 14));
    const lines = csv.split('\r\n');
    expect(lines[0].startsWith('﻿Name;')).toBe(true);
    expect(lines.length).toBe(1 + store.swimmers().filter((p) => p.groupId === 'WK').length);
  });
});
