import { Injectable, computed, signal } from '@angular/core';
import { createSampleData, DEMO_TRAINER_ID, markKey, PARENT_CHILD_IDS } from './sample-data';
import {
  addDays,
  addMonths,
  dayMonth,
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
  DEFAULT_REASONS,
  DemoRole,
  GROUPS,
  GroupDefaults,
  GroupId,
  MailTemplate,
  OTHER_REASON,
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
  /** True when the person had registered for every missed session. */
  registered: boolean;
  /** How many of the missed sessions had no answer at all. */
  unanswered: number;
}

export interface Attendee {
  person: Person;
  role: PersonRole;
}

export interface MatrixRow {
  person: Person;
  isTrainer: boolean;
  /** One cell per session; null when the person is not part of that session. */
  cells: (AttendanceState | null)[];
}

export interface Matrix {
  sessions: TrainingSession[];
  rows: MatrixRow[];
}

export type ExportContent = 'blank' | 'filled';

const MAX_SERIES_LENGTH = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

function compareSessions(a: TrainingSession, b: TrainingSession): number {
  return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
}

function byName(a: Person, b: Person): number {
  return a.name.localeCompare(b.name, 'de');
}

function responseKey(sessionId: string, personId: string, role: PersonRole): string {
  return `${sessionId}:${personId}:${role}`;
}

/**
 * In-memory store with invented sample data. It stands in for the backend until the
 * training API and its Prisma models exist; the public methods mark the future API surface.
 */
export interface SettingsSnapshot {
  venues: Venue[];
  defaults: Record<GroupId, GroupDefaults>;
  automation: AutomationSettings;
  templates: MailTemplate[];
  reasons: DeclineReason[];
  season: number;
}

@Injectable({ providedIn: 'root' })
export class TrainingStore {
  readonly today = toIsoDate(new Date());
  readonly groups: readonly TrainingGroup[] = GROUPS;
  readonly role = signal<DemoRole>('admin');
  /** One-time message shown after saving on another page. */
  readonly flash = signal('');

  private readonly sample = createSampleData(this.today);
  private nextSessionNumber = this.sample.sessions.length + 1;
  private nextId = 1;

  readonly people = signal<Person[]>(this.sample.people);
  readonly venues = signal<Venue[]>(this.sample.venues);
  readonly sessions = signal<TrainingSession[]>([...this.sample.sessions].sort(compareSessions));
  readonly responses = signal(this.sample.responses);
  readonly marks = signal<Record<string, Presence>>(this.sample.marks);
  readonly defaults = signal<Record<GroupId, GroupDefaults>>(this.sample.defaults);
  readonly automation = signal<AutomationSettings>(this.sample.automation);
  readonly templates = signal<MailTemplate[]>(this.sample.templates);
  readonly reasons = signal<DeclineReason[]>([...DEFAULT_REASONS]);
  /** First year of the season whose data is kept; changeable in the settings. */
  readonly season = signal(Number(this.today.slice(0, 4)));
  /** Swimmers that were set to inactive or informed by mail from the action list. */
  readonly handledIds = signal<string[]>([]);
  readonly inactiveIds = signal<string[]>([]);

  readonly swimmers = computed(() =>
    this.people()
      .filter((person) => person.groupId !== null)
      .sort(byName),
  );
  readonly trainers = computed(() =>
    this.people()
      .filter((person) => person.trainerGroupIds.length > 0)
      .sort(byName),
  );
  private readonly peopleById = computed(
    () => new Map(this.people().map((person) => [person.id, person])),
  );
  private readonly responseMap = computed(() => {
    const map = new Map<string, SessionResponse>();
    for (const response of this.responses()) {
      map.set(responseKey(response.sessionId, response.personId, response.asRole), response);
    }
    return map;
  });
  private readonly responsesBySession = computed(() => {
    const map = new Map<string, SessionResponse[]>();
    for (const response of this.responses()) {
      const list = map.get(response.sessionId);
      if (list) list.push(response);
      else map.set(response.sessionId, [response]);
    }
    return map;
  });

  /** Persons whose registrations the current demo user manages. */
  readonly actors = computed<Person[]>(() => {
    const ids = this.role() === 'parent' ? PARENT_CHILD_IDS : [DEMO_TRAINER_ID];
    const byId = this.peopleById();
    return ids.map((id) => byId.get(id)).filter((person): person is Person => !!person);
  });

  /** Groups whose attendance the current user may see: admins all, trainers the groups they train. */
  readonly viewableGroups = computed<TrainingGroup[]>(() => {
    if (this.role() === 'admin') return [...this.groups];
    const own = new Set(this.actors().flatMap((person) => person.trainerGroupIds));
    return this.groups.filter((group) => own.has(group.id));
  });

  readonly canManage = computed(() => this.role() !== 'parent');
  readonly isAdmin = computed(() => this.role() === 'admin');

  // --- Lookups --------------------------------------------------------------------------------

  person(id: string): Person | undefined {
    return this.peopleById().get(id);
  }

  personName(id: string): string {
    return this.person(id)?.name ?? '?';
  }

  groupName(id: GroupId): string {
    return this.groups.find((group) => group.id === id)?.name ?? id;
  }

  groupNames(session: TrainingSession): string {
    return session.groupIds.map((id) => this.groupName(id)).join(', ');
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
    return new Date(`${session.deadlineDate}T${session.deadlineTime}:00`).getTime() > now.getTime();
  }

  deadlineLabel(session: TrainingSession): string {
    return `${weekdayShort(session.deadlineDate)} ${dayMonth(session.deadlineDate)}, ${session.deadlineTime}`;
  }

  // --- Participants ---------------------------------------------------------------------------

  /** How a person takes part in a session. Somebody who trains it does not also swim it. */
  roleIn(session: TrainingSession, person: Person): PersonRole | null {
    if (session.trainerIds.includes(person.id)) return 'trainer';
    const inGroup = person.groupId !== null && session.groupIds.includes(person.groupId);
    return inGroup || session.extraSwimmerIds.includes(person.id) ? 'swimmer' : null;
  }

  /** Swimmers expected at a session: group members and extra swimmers, without its trainers. */
  sessionSwimmers(session: TrainingSession): Person[] {
    return this.swimmers().filter((person) => this.roleIn(session, person) === 'swimmer');
  }

  /** Everybody on the attendance list: trainers first, then swimmers. */
  attendees(session: TrainingSession): Attendee[] {
    const byId = this.peopleById();
    const trainerIds = new Set(session.trainerIds);
    for (const response of this.responsesBySession().get(session.id) ?? []) {
      if (response.asRole === 'trainer') trainerIds.add(response.personId);
    }
    const trainers: Attendee[] = [];
    for (const id of trainerIds) {
      const person = byId.get(id);
      if (person) trainers.push({ person, role: 'trainer' });
    }
    trainers.sort((a, b) => byName(a.person, b.person));
    const swimmers = this.sessionSwimmers(session)
      .filter((person) => !trainerIds.has(person.id))
      .map((person): Attendee => ({ person, role: 'swimmer' }));
    return [...trainers, ...swimmers];
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
    const byId = this.peopleById();
    const result = { trainers: [] as Person[], swimmers: [] as Person[] };
    for (const response of this.responsesBySession().get(session.id) ?? []) {
      const person = byId.get(response.personId);
      if (!person || response.status !== 'registered') continue;
      if (response.asRole === 'trainer') result.trainers.push(person);
      else if (this.roleIn(session, person) === 'swimmer') result.swimmers.push(person);
    }
    result.trainers.sort(byName);
    result.swimmers.sort(byName);
    return result;
  }

  // --- Attendance -----------------------------------------------------------------------------

  /**
   * Taken from the registration, the trainer can override it:
   * registered means present, declined means excused, no answer means missing.
   */
  stateOf(session: TrainingSession, personId: string, role: PersonRole): AttendanceState {
    const response = this.responseOf(session.id, personId, role);
    if (response?.status === 'declined') return 'excused';
    const mark = this.marks()[markKey(session.id, personId)];
    if (mark) return mark;
    return response?.status === 'registered' ? 'present' : 'missing';
  }

  setAttendance(
    sessionId: string,
    personId: string,
    role: PersonRole,
    state: AttendanceState,
  ): void {
    if (state === 'excused') {
      this.respond(sessionId, personId, role, 'declined', OTHER_REASON);
      return;
    }
    if (this.responseOf(sessionId, personId, role)?.status === 'declined') {
      this.respond(sessionId, personId, role, 'registered');
    }
    this.marks.update((marks) => ({ ...marks, [markKey(sessionId, personId)]: state }));
  }

  /** Adds somebody without a registration; pure trainers join as trainer, all others swim. */
  addWithoutRegistration(sessionId: string, person: Person): void {
    this.sessions.update((all) =>
      all.map((session) => {
        if (session.id !== sessionId) return session;
        if (person.groupId === null) {
          return { ...session, trainerIds: [...new Set([...session.trainerIds, person.id])] };
        }
        return {
          ...session,
          extraSwimmerIds: [...new Set([...session.extraSwimmerIds, person.id])],
        };
      }),
    );
    this.marks.update((marks) => ({ ...marks, [markKey(sessionId, person.id)]: 'present' }));
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
      const weekIndex = Math.floor((parseIsoDate(date).getTime() - baseTime) / (7 * DAY_MS));
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
    const offset = (Date.parse(session.deadlineDate) - Date.parse(session.date)) / DAY_MS;
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

  findSession(id: string): TrainingSession | undefined {
    return this.sessions().find((session) => session.id === id);
  }

  /** A copy of a session one week later, not saved yet. */
  copyOf(session: TrainingSession): TrainingSession {
    return {
      ...session,
      id: '',
      date: addDays(session.date, 7),
      deadlineDate: addDays(session.deadlineDate, 7),
      groupIds: [...session.groupIds],
      trainerIds: [...session.trainerIds],
      extraSwimmerIds: [...session.extraSwimmerIds],
    };
  }

  deleteSession(id: string): void {
    this.sessions.update((all) => all.filter((session) => session.id !== id));
    this.responses.update((all) => all.filter((item) => item.sessionId !== id));
  }

  // --- Venues, reasons, templates and defaults ------------------------------------------------

  addVenue(name: string): void {
    const trimmed = name.trim();
    if (trimmed)
      this.venues.update((all) => [...all, { id: `v-new-${this.nextId++}`, name: trimmed }]);
  }

  renameVenue(id: string, name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.venues.update((all) => all.map((v) => (v.id === id ? { ...v, name: trimmed } : v)));
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

  addReason(name: string): void {
    const trimmed = name.trim();
    if (trimmed && !this.reasons().includes(trimmed)) {
      this.reasons.update((all) => [
        ...all.filter((r) => r !== OTHER_REASON),
        trimmed,
        OTHER_REASON,
      ]);
    }
  }

  removeReason(name: string): void {
    if (name !== OTHER_REASON)
      this.reasons.update((all) => all.filter((reason) => reason !== name));
  }

  saveTemplate(template: MailTemplate): void {
    const exists = this.templates().some((item) => item.id === template.id);
    this.templates.update((all) =>
      exists
        ? all.map((item) => (item.id === template.id ? template : item))
        : [...all, { ...template, id: `t-new-${this.nextId++}` }],
    );
  }

  deleteTemplate(id: string): void {
    this.templates.update((all) => all.filter((item) => item.id !== id));
  }

  templateText(id: string, name: string): string {
    const text = this.templates().find((item) => item.id === id)?.text ?? '';
    return text.replace('{Name}', name.split(' ')[0]);
  }

  updateDefaults(groupId: GroupId, change: Partial<GroupDefaults>): void {
    this.defaults.update((all) => ({ ...all, [groupId]: { ...all[groupId], ...change } }));
  }

  /** Copy of everything the settings page edits, so that "Abbrechen" can restore it. */
  settingsSnapshot(): SettingsSnapshot {
    return {
      venues: this.venues(),
      defaults: this.defaults(),
      automation: this.automation(),
      templates: this.templates(),
      reasons: this.reasons(),
      season: this.season(),
    };
  }

  restoreSettings(snapshot: SettingsSnapshot): void {
    this.venues.set(snapshot.venues);
    this.defaults.set(snapshot.defaults);
    this.automation.set(snapshot.automation);
    this.templates.set(snapshot.templates);
    this.reasons.set(snapshot.reasons);
    this.season.set(snapshot.season);
  }

  updateAutomation(change: Partial<AutomationSettings>): void {
    this.automation.update((current) => ({ ...current, ...change }));
  }

  // --- Calendar -------------------------------------------------------------------------------

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
        continue;
      }
      const labels: string[] = [];
      for (const actor of actors) {
        if (this.roleIn(session, actor))
          labels.push(role === 'parent' ? actor.name.split(' ')[0] : '');
      }
      if (labels.length > 0) entries.push({ session, labels: labels.filter(Boolean) });
    }
    return entries;
  }

  // --- Attendance overview --------------------------------------------------------------------

  /** Past sessions in which a person took part, oldest first. */
  personSessions(person: Person): TrainingSession[] {
    return this.sessions().filter(
      (session) => session.date < this.today && this.roleIn(session, person) === 'swimmer',
    );
  }

  /** One group, or "all" for every group the user may see. */
  matrix(selection: GroupId | 'all', from: string, to: string): Matrix {
    const groupIds =
      selection === 'all' ? this.viewableGroups().map((group) => group.id) : [selection];
    const sessions = this.sessions().filter(
      (session) =>
        session.date < this.today &&
        (!from || session.date >= from) &&
        (!to || session.date <= to) &&
        session.groupIds.some((id) => groupIds.includes(id)),
    );
    const members = this.people()
      .filter(
        (person) =>
          (person.groupId !== null && groupIds.includes(person.groupId)) ||
          person.trainerGroupIds.some((id) => groupIds.includes(id)),
      )
      .sort(byName);
    const rows = members.map((person): MatrixRow => {
      const cells = sessions.map((session) => {
        const role = this.roleIn(session, person);
        return role ? this.stateOf(session, person.id, role) : null;
      });
      const swimsHere = person.groupId !== null && groupIds.includes(person.groupId);
      return { person, isTrainer: !swimsHere, cells };
    });
    rows.sort((a, b) => Number(b.isTrainer) - Number(a.isTrainer));
    return { sessions, rows };
  }

  /** Missed sessions in a row, counted from the most recent one. */
  missingStreak(person: Person): { count: number; registered: boolean; unanswered: number } {
    const sessions = this.personSessions(person);
    let count = 0;
    let registered = true;
    let unanswered = 0;
    for (let index = sessions.length - 1; index >= 0; index--) {
      const session = sessions[index];
      if (this.stateOf(session, person.id, 'swimmer') !== 'missing') break;
      count++;
      if (this.responseOf(session.id, person.id, 'swimmer')?.status !== 'registered') {
        registered = false;
        unanswered++;
      }
    }
    return { count, registered, unanswered };
  }

  actionNeeded(): { inactive: ActionNeeded[]; info: ActionNeeded[] } {
    const settings = this.automation();
    const skip = new Set([...this.handledIds(), ...this.inactiveIds()]);
    const inactive: ActionNeeded[] = [];
    const info: ActionNeeded[] = [];
    const visible = new Set(this.viewableGroups().map((group) => group.id));
    for (const person of this.swimmers()) {
      if (skip.has(person.id) || person.groupId === null || !visible.has(person.groupId)) continue;
      const { count, registered, unanswered } = this.missingStreak(person);
      const entry = { person, streak: count, registered, unanswered };
      if (count >= settings.inactiveAfter) inactive.push(entry);
      else if (count >= settings.infoMailAfter) info.push(entry);
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
  attendanceCsv(groupId: GroupId, content: ExportContent, from: string, to: string): string {
    const sessions = this.sessions().filter(
      (session) =>
        session.groupIds.includes(groupId) &&
        session.date >= from &&
        session.date <= to &&
        (content === 'blank' || session.date < this.today),
    );
    const words: Record<AttendanceState, string> = {
      present: 'anwesend',
      missing: 'fehlt',
      excused: 'abgemeldet',
    };
    const lines = [['Name', ...sessions.map((s) => `${shortDay(s.date)} ${s.time}`)]];
    for (const person of this.swimmers().filter((candidate) => candidate.groupId === groupId)) {
      lines.push([
        person.name,
        ...sessions.map((session) => {
          if (content === 'blank') return '';
          const role = this.roleIn(session, person);
          return role ? words[this.stateOf(session, person.id, role)] : '';
        }),
      ]);
    }
    return '﻿' + lines.map((line) => line.join(';')).join('\r\n');
  }
}
