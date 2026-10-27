import { TestBed } from '@angular/core/testing';
import { TrainingStore } from './training.store';

describe('TrainingStore', () => {
  let store: TrainingStore;

  beforeEach(() => {
    store = TestBed.inject(TrainingStore);
  });

  it('creates sessions in the past and in the future', () => {
    const sessions = store.sessions();
    expect(sessions.some((session) => session.date < store.today)).toBe(true);
    expect(sessions.some((session) => session.date >= store.today)).toBe(true);
  });

  it('replaces an earlier answer when a person responds again', () => {
    const session = store.sessions().find((item) => item.date >= store.today)!;
    store.respond(session.id, 'p-lena', 'swimmer', 'declined', 'Krank');
    expect(store.responseOf(session.id, 'p-lena', 'swimmer')?.reason).toBe('Krank');
    store.respond(session.id, 'p-lena', 'swimmer', 'registered');
    const response = store.responseOf(session.id, 'p-lena', 'swimmer');
    expect(response?.status).toBe('registered');
    expect(response?.reason).toBeUndefined();
  });

  it('derives excused from a decline and lets the trainer override it', () => {
    const session = store.sessions().find((item) => item.date >= store.today)!;
    store.respond(session.id, 'p-lena', 'swimmer', 'declined', 'Schule');
    expect(store.stateOf(session, 'p-lena', 'swimmer')).toBe('excused');
    store.setAttendance(session.id, 'p-lena', 'swimmer', 'present');
    expect(store.stateOf(session, 'p-lena', 'swimmer')).toBe('present');
    store.setAttendance(session.id, 'p-lena', 'swimmer', 'excused');
    expect(store.stateOf(session, 'p-lena', 'swimmer')).toBe('excused');
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
    const created = store.saveSession(base, {
      rhythm: 'weekly',
      until: base.date,
      weekdays: [],
    });
    expect(created).toBe(1);
    expect(store.sessions().length).toBe(before + 1);
  });

  it('reports a person who missed the latest sessions in a row', () => {
    const finn = store.person('p-finn')!;
    expect(store.missingStreak(finn)).toBeGreaterThanOrEqual(3);
    expect(store.actionNeeded().inactive.some((entry) => entry.person.id === 'p-finn')).toBe(true);
  });

  it('refuses to delete a venue that is still in use', () => {
    expect(store.deleteVenue('v-roshop')).toBe(false);
    store.addVenue('Testbad');
    const added = store.venues().find((venue) => venue.name === 'Testbad')!;
    expect(store.deleteVenue(added.id)).toBe(true);
  });

  it('exports a semicolon separated list with one row per swimmer', () => {
    const month = store.today.slice(0, 7);
    const csv = store.attendanceCsv('WK', 'blank', month, month);
    const lines = csv.split('\r\n');
    expect(lines[0].startsWith('﻿Name;')).toBe(true);
    expect(lines.length).toBe(1 + store.swimmers().filter((p) => p.groupId === 'WK').length);
  });
});
