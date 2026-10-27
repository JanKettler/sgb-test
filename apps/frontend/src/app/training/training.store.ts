import { Injectable, computed, signal } from '@angular/core';
import { createSampleData, markKey, PARENT_CHILD_IDS, DEMO_TRAINER_ID } from './sample-data';
import {
  addDays,
  addMonths,
  dayMonth,
  fullDate,
  monthKey,
  parseIsoDate,
  shortDay,
  toIsoDate,
  weekdayIndex,
  weekdayShort,
} from './training-dates';
import {
  AttendanceState,
  AutomationSettings,
  DeclineReason,
  DemoRole,
  GROUPS,
  GroupDefaults,
  GroupId,
  Person,
  PersonRole,
  Presence,
  SessionResponse,
  TrainingGroup,
  TrainingSession,
  Venue,
} from './training.models';

export interface RepeatOptions {
  rhythm: 'weekly' | 'biweekly' | 'monthly';
  until: string;
  /** 0 = Sunday ... 6 = Saturday */
  weekdays: number[];
}

export interface ActionNeeded {
  person: Person;
  streak: number;
}

export interface MatrixRow {
  person: Person;
  cells: (AttendanceState | null)[];
}

export interface Matrix {
  sessions: TrainingSession[];
  rows: MatrixRow[];
}

export type ExportContent = 'blank' | 'filled';

const MAX_SERIES_LENGTH = 120;

function compareSessions(a: TrainingSession, b: TrainingSession): number {
  return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
}

function responseKey(sessionId: string, personId: string, role: PersonRole): string {
  return `${sessionId}:${personId}:${role}`;
}

/**
 * In-memory store with invented sample data. It stands in for the backend until the
 * training API and its Prisma models exist; the public methods mark the future API surface.
 */
@Injectable({ providedIn: 'root' })
export class TrainingStore {
  readonly today = toIsoDate(new Date());
  readonly groups: readonly TrainingGroup[] = GROUPS;
  readonly role = signal<DemoRole>('admin');

  private readonly sample = createSampleData(this.today);
  private nextSessionNumber = this.sample.sessions.length + 1;
  private nextVenueNumber = this.sample.venues.length + 1;

  readonly people = signal<Person[]>(this.sample.people);
  readonly venues = signal<Venue[]>(this.sample.venues);
  readonly sessions = signal<TrainingSession[]>([...this.sample.sessions].sort(compareSessions));
  readonly responses = signal<SessionResponse[]>(this.sample.responses);
  readonly marks = signal<Record<string, Presence>>(this.sample.marks);
  readonly defaults = signal<Record<GroupId, GroupDefaults>>(this.sample.defaults);
  readonly automation = signal<AutomationSettings>(this.sample.automation);
  /** Swimmers that were set to inactive or informed by mail from the action list. */
  readonly handledIds = signal<string[]>([]);
  readonly inactiveIds = signal<string[]>([]);

  readonly trainers = computed(() => this.people().filter((person) => person.role === 'trainer'));
  readonly swimmers = computed(() => this.people().filter((person) => person.role === 'swimmer'));

  private readonly responseMap = computed(() => {
    const map = new Map<string, SessionResponse>();
    for (const response of this.responses()) {
      map.set(responseKey(response.sessionId, response.personId, response.asRole), response);
    }
    return map;
  });

  /** Persons whose registrations the current demo user manages. */
  readonly actors = computed<Person[]>(() => {
    const ids = this.role() === 'parent' ? PARENT_CHILD_IDS : [DEMO_TRAINER_ID];
    return ids
      .map((id) => this.people().find((person) => person.id === id))
      .filter((person): person is Person => person !== undefined);
  });

  readonly canManage = computed(() => this.role() !== 'parent');
  readonly isAdmin = computed(() => this.role() === 'admin');

  person(id: string): Person | undefined {
    return this.people().find((person) => person.id === id);
  }

  personName(id: string): string {
    return this.person(id)?.name ?? '?';
  }

  groupName(id: GroupId): string {
    return this.groups.find((group) => group.id === id)?.name ?? id;
  }

  venueName(id: string): string {
    return this.venues().find((venue) => venue.id === id)?.name ?? '?';
  }

  isPast(session: TrainingSession): boolean {
    return session.date < this.today;
  }

  /** Attendance may be kept from the day of the session on. */
  attendanceStarted(session: TrainingSession): boolean {
    return session.date <= this.today;
  }

  deadlineOpen(session: TrainingSession, now = new Date()): boolean {
    const deadline = new Date(`${session.deadlineDate}T${session.deadlineTime}:00`);
    return deadline.getTime() > now.getTime();
  }

  deadlineLabel(session: TrainingSession): string {
    return `${weekdayShort(session.deadlineDate)} ${dayMonth(session.deadlineDate)}, ${session.deadlineTime}`;
  }

  /** Swimmers expected at a session: members of the selected groups plus extra swimmers. */
  sessionSwimmers(session: TrainingSession): Person[] {
    const extras = new Set(session.extraSwimmerIds);
    return this.swimmers()
      .filter(
        (person) =>
          (person.groupId !== null && session.groupIds.includes(person.groupId)) ||
          extras.has(person.id),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  responseOf(sessionId: string, personId: string, role: PersonRole): SessionResponse | undefined {
    return this.responseMap().get(responseKey(sessionId, personId, role));
  }

  respond(
    sessionId: string,
    personId: string,
    asRole: PersonRole,
    status: SessionResponse['status'],
    reason?: DeclineReason,
    note?: string,
  ): void {
    const entry: SessionResponse = { sessionId, personId, asRole, status };
    if (status === 'declined' && reason) entry.reason = reason;
    if (status === 'declined' && note?.trim()) entry.note = note.trim();
    this.responses.update((all) => [
      ...all.filter(
        (item) =>
          !(item.sessionId === sessionId && item.personId === personId && item.asRole === asRole),
      ),
      entry,
    ]);
  }

  /** Registered persons of a session; trainers first, then swimmers. */
  registered(session: TrainingSession): { trainers: Person[]; swimmers: Person[] } {
    const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, 'de');
    const people = this.people();
    const registeredIds = (role: PersonRole) =>
      this.responses()
        .filter(
          (item) =>
            item.sessionId === session.id && item.asRole === role && item.status === 'registered',
        )
        .map((item) => item.personId);
    return {
      trainers: registeredIds('trainer')
        .map((id) => people.find((person) => person.id === id))
        .filter((person): person is Person => person !== undefined)
        .sort(byName),
      swimmers: registeredIds('swimmer')
        .map((id) => people.find((person) => person.id === id))
        .filter((person): person is Person => person !== undefined)
        .sort(byName),
    };
  }

  stateOf(session: TrainingSession, personId: string, role: PersonRole): AttendanceState {
    const response = this.responseOf(session.id, personId, role);
    if (response?.status === 'declined') return 'excused';
    return this.marks()[markKey(session.id, personId)] === 'present' ? 'present' : 'missing';
  }

  setPresence(sessionId: string, personId: string, presence: Presence): void {
    this.marks.update((marks) => ({ ...marks, [markKey(sessionId, personId)]: presence }));
  }

  /** The trainer's choice overrides the registration: present/missing clears a decline. */
  setAttendance(
    sessionId: string,
    personId: string,
    role: PersonRole,
    state: AttendanceState,
  ): void {
    if (state === 'excused') {
      this.respond(sessionId, personId, role, 'declined', 'Sonstiges');
      return;
    }
    if (this.responseOf(sessionId, personId, role)?.status === 'declined') {
      this.respond(sessionId, personId, role, 'registered');
    }
    this.setPresence(sessionId, personId, state);
  }

  /** Everybody who belongs on the attendance list of a session. */
  attendees(session: TrainingSession): { person: Person; role: PersonRole }[] {
    const trainerIds = new Set([
      ...session.trainerIds,
      ...this.registered(session).trainers.map((trainer) => trainer.id),
    ]);
    const trainers = this.trainers()
      .filter((trainer) => trainerIds.has(trainer.id))
      .map((person) => ({ person, role: 'trainer' as PersonRole }));
    const swimmers = this.sessionSwimmers(session).map((person) => ({
      person,
      role: 'swimmer' as PersonRole,
    }));
    return [...trainers, ...swimmers];
  }

  addWalkIn(sessionId: string, personId: string): void {
    this.sessions.update((all) =>
      all.map((session) =>
        session.id === sessionId && !session.extraSwimmerIds.includes(personId)
          ? { ...session, extraSwimmerIds: [...session.extraSwimmerIds, personId] }
          : session,
      ),
    );
    this.setPresence(sessionId, personId, 'present');
  }

  // --- Sessions -------------------------------------------------------------------------------

  emptySession(): TrainingSession {
    const groupId: GroupId = 'G1';
    const defaults = this.defaults()[groupId];
    const date = addDays(this.today, 7);
    return {
      id: '',
      date,
      time: '17:30',
      durationMinutes: defaults.durationMinutes,
      venueId: defaults.venueId,
      groupIds: [groupId],
      note: '',
      trainerIds: [...defaults.trainerIds],
      extraSwimmerIds: [],
      maxSwimmers: defaults.maxSwimmers,
      maxTrainers: defaults.maxTrainers,
      deadlineDate: addDays(date, -defaults.deadlineDaysBefore),
      deadlineTime: defaults.deadlineTime,
    };
  }

  /** Trainers that are responsible for at least one of the selected groups. */
  trainersForGroups(groupIds: GroupId[]): Person[] {
    return this.trainers().filter((trainer) =>
      trainer.trainerGroupIds.some((groupId) => groupIds.includes(groupId)),
    );
  }

  repeatDates(baseDate: string, repeat: RepeatOptions): string[] {
    const dates = [baseDate];
    if (repeat.rhythm === 'monthly') {
      for (let step = 1; dates.length < MAX_SERIES_LENGTH; step++) {
        const date = addMonths(baseDate, step);
        if (date > repeat.until) break;
        dates.push(date);
      }
      return dates;
    }
    const stepWeeks = repeat.rhythm === 'biweekly' ? 2 : 1;
    const baseTime = parseIsoDate(baseDate).getTime();
    for (
      let date = addDays(baseDate, 1);
      date <= repeat.until && dates.length < MAX_SERIES_LENGTH;
      date = addDays(date, 1)
    ) {
      const weekIndex = Math.floor(
        (parseIsoDate(date).getTime() - baseTime) / (7 * 24 * 60 * 60 * 1000),
      );
      if (weekIndex % stepWeeks === 0 && repeat.weekdays.includes(weekdayIndex(date))) {
        dates.push(date);
      }
    }
    return dates;
  }

  /** Saves a session. Returns the number of sessions that were created or changed. */
  saveSession(session: TrainingSession, repeat: RepeatOptions | null): number {
    if (session.id) {
      this.sessions.update((all) =>
        all.map((item) => (item.id === session.id ? { ...session } : item)).sort(compareSessions),
      );
      return 1;
    }
    const offset = (Date.parse(session.deadlineDate) - Date.parse(session.date)) / 86400000;
    const dates = repeat ? this.repeatDates(session.date, repeat) : [session.date];
    const created = dates.map((date) => ({
      ...session,
      id: `s${this.nextSessionNumber++}`,
      date,
      deadlineDate: addDays(date, offset),
    }));
    this.sessions.update((all) => [...all, ...created].sort(compareSessions));
    return created.length;
  }

  copySession(id: string): TrainingSession | undefined {
    const original = this.sessions().find((session) => session.id === id);
    if (!original) return undefined;
    return {
      ...original,
      id: '',
      date: addDays(original.date, 7),
      deadlineDate: addDays(original.deadlineDate, 7),
      groupIds: [...original.groupIds],
      trainerIds: [...original.trainerIds],
      extraSwimmerIds: [...original.extraSwimmerIds],
    };
  }

  deleteSession(id: string): void {
    this.sessions.update((all) => all.filter((session) => session.id !== id));
    this.responses.update((all) => all.filter((item) => item.sessionId !== id));
  }

  // --- Venues and settings -------------------------------------------------------------------

  addVenue(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.venues.update((all) => [...all, { id: `v-new-${this.nextVenueNumber++}`, name: trimmed }]);
  }

  renameVenue(id: string, name: string): void {
    this.venues.update((all) =>
      all.map((venue) => (venue.id === id ? { ...venue, name: name.trim() || venue.name } : venue)),
    );
  }

  venueInUse(id: string): boolean {
    return (
      this.sessions().some((session) => session.venueId === id) ||
      Object.values(this.defaults()).some((defaults) => defaults.venueId === id)
    );
  }

  deleteVenue(id: string): boolean {
    if (this.venueInUse(id)) return false;
    this.venues.update((all) => all.filter((venue) => venue.id !== id));
    return true;
  }

  updateDefaults(groupId: GroupId, change: Partial<GroupDefaults>): void {
    this.defaults.update((all) => ({ ...all, [groupId]: { ...all[groupId], ...change } }));
  }

  updateAutomation(change: Partial<AutomationSettings>): void {
    this.automation.update((current) => ({ ...current, ...change }));
  }

  // --- Calendar --------------------------------------------------------------------------------

  /** Sessions in the next seven days that are relevant for the current demo user. */
  weekEntries(): { session: TrainingSession; labels: string[] }[] {
    const last = addDays(this.today, 6);
    const role = this.role();
    const actors = this.actors();
    const entries: { session: TrainingSession; labels: string[] }[] = [];
    for (const session of this.sessions()) {
      if (session.date < this.today || session.date > last) continue;
      if (role === 'admin') {
        entries.push({ session, labels: [] });
      } else if (role === 'trainer') {
        if (session.trainerIds.includes(DEMO_TRAINER_ID)) entries.push({ session, labels: [] });
      } else {
        const children = actors.filter((child) =>
          this.sessionSwimmers(session).some((swimmer) => swimmer.id === child.id),
        );
        if (children.length > 0) {
          entries.push({ session, labels: children.map((child) => child.name.split(' ')[0]) });
        }
      }
    }
    return entries;
  }

  // --- Attendance overview --------------------------------------------------------------------

  /** Past sessions that are relevant for a person, oldest first. */
  personSessions(person: Person, from?: string, to?: string): TrainingSession[] {
    return this.sessions().filter(
      (session) =>
        session.date < this.today &&
        (from === undefined || session.date >= from) &&
        (to === undefined || session.date <= to) &&
        ((person.groupId !== null && session.groupIds.includes(person.groupId)) ||
          session.extraSwimmerIds.includes(person.id)),
    );
  }

  matrix(groupId: GroupId, fromMonth: string, toMonth: string): Matrix {
    const from = `${fromMonth}-01`;
    const to = `${toMonth}-31`;
    const people = this.swimmers()
      .filter((person) => person.groupId === groupId)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const sessions = this.sessions().filter(
      (session) =>
        session.date < this.today &&
        session.date >= from &&
        session.date <= to &&
        session.groupIds.includes(groupId),
    );
    return {
      sessions,
      rows: people.map((person) => ({
        person,
        cells: sessions.map((session) => this.stateOf(session, person.id, 'swimmer')),
      })),
    };
  }

  /** Number of missed sessions in a row, counted from the most recent session. */
  missingStreak(person: Person): number {
    const sessions = this.personSessions(person);
    let streak = 0;
    for (let index = sessions.length - 1; index >= 0; index--) {
      if (this.stateOf(sessions[index], person.id, 'swimmer') !== 'missing') break;
      streak++;
    }
    return streak;
  }

  actionNeeded(groupId?: GroupId): { inactive: ActionNeeded[]; info: ActionNeeded[] } {
    const settings = this.automation();
    const inactive: ActionNeeded[] = [];
    const info: ActionNeeded[] = [];
    for (const person of this.swimmers()) {
      if (groupId && person.groupId !== groupId) continue;
      if (this.handledIds().includes(person.id) || this.inactiveIds().includes(person.id)) continue;
      const streak = this.missingStreak(person);
      if (streak >= settings.inactiveAfter) inactive.push({ person, streak });
      else if (streak >= settings.infoMailAfter) info.push({ person, streak });
    }
    return { inactive, info };
  }

  markHandled(personId: string): void {
    this.handledIds.update((ids) => [...ids, personId]);
  }

  markInactive(personId: string): void {
    this.inactiveIds.update((ids) => [...ids, personId]);
  }

  /** Months (yyyy-MM) in which sessions exist, oldest first. */
  monthOptions(): string[] {
    return [...new Set(this.sessions().map((session) => monthKey(session.date)))].sort();
  }

  // --- Excel / CSV export ---------------------------------------------------------------------

  /** Semicolon separated text with a BOM: opens directly in German Excel. */
  attendanceCsv(
    groupId: GroupId,
    content: ExportContent,
    fromMonth: string,
    toMonth: string,
  ): string {
    const matrix = this.matrix(groupId, fromMonth, toMonth);
    // Include future sessions of the range when the list is meant to be filled in by hand.
    const sessions =
      content === 'blank'
        ? this.sessions().filter(
            (session) =>
              session.groupIds.includes(groupId) &&
              monthKey(session.date) >= fromMonth &&
              monthKey(session.date) <= toMonth,
          )
        : matrix.sessions;
    const label = (session: TrainingSession) => `${shortDay(session.date)} ${session.time}`;
    const lines = [['Name', ...sessions.map(label)]];
    const names = this.swimmers()
      .filter((person) => person.groupId === groupId)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const words: Record<AttendanceState, string> = {
      present: 'anwesend',
      missing: 'fehlt',
      excused: 'abgemeldet',
    };
    for (const person of names) {
      lines.push([
        person.name,
        ...sessions.map((session) =>
          content === 'blank' ? '' : words[this.stateOf(session, person.id, 'swimmer')],
        ),
      ]);
    }
    return '﻿' + lines.map((line) => line.join(';')).join('\r\n');
  }

  formatSessionTitle(session: TrainingSession): string {
    return `${shortDay(session.date)} ${session.time}`;
  }

  formatFullDate(iso: string): string {
    return fullDate(iso);
  }
}
