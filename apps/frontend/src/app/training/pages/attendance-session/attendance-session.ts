import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Icon } from '../../../ui/icon';
import { PersonPickerDialog } from '../../dialogs/person-picker-dialog';
import { endTime, fullDate } from '../../training-dates';
import { downloadText } from '../../training-download';
import { AttendanceState, Person, PersonRole } from '../../training.models';
import { TrainingStore } from '../../training.store';

const SEGMENTS: readonly { state: AttendanceState; label: string }[] = [
  { state: 'present', label: 'Anwesend' },
  { state: 'missing', label: 'Fehlt' },
  { state: 'excused', label: 'Abgemeldet' },
];

const WORDS: Record<AttendanceState, string> = {
  present: 'anwesend',
  missing: 'fehlt',
  excused: 'abgemeldet',
};

interface AttendanceRow {
  person: Person;
  role: PersonRole;
  group: string;
  state: AttendanceState;
  registration: 'registered' | 'declined' | 'none';
  reason: string;
}

/** Attendance of one session. Registrations are taken over and can be overridden. */
@Component({
  selector: 'app-attendance-session',
  imports: [RouterLink, Icon, PersonPickerDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './attendance-session.html',
  styleUrl: './attendance-session.scss',
})
export class AttendanceSession {
  private readonly store = inject(TrainingStore);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  protected readonly segments = SEGMENTS;
  protected readonly adding = signal(false);

  protected readonly session = computed(() => {
    const id = this.params()?.get('id');
    return id ? this.store.findSession(id) : undefined;
  });

  protected readonly subtitle = computed(() => {
    const session = this.session();
    if (!session) return '';
    const end = endTime(session.time, session.durationMinutes);
    return `${fullDate(session.date)}, ${session.time} bis ${end}, ${this.store.groupNames(session)}`;
  });

  protected readonly rows = computed<AttendanceRow[]>(() => {
    const session = this.session();
    if (!session) return [];
    return this.store.attendees(session).map(({ person, role }) => {
      const response = this.store.responseOf(session.id, person.id, role);
      return {
        person,
        role,
        group:
          role === 'trainer' || !person.groupId ? 'Trainer' : this.store.groupName(person.groupId),
        state: this.store.stateOf(session, person.id, role),
        registration: response?.status ?? 'none',
        reason: response?.reason ?? '',
      };
    });
  });

  protected readonly tiles = computed(() => {
    const rows = this.rows();
    const count = (test: (row: AttendanceRow) => boolean) => rows.filter(test).length;
    return [
      { label: 'Angemeldet', value: count((row) => row.registration === 'registered'), tone: '' },
      { label: 'Anwesend', value: count((row) => row.state === 'present'), tone: 'ok' },
      {
        label: 'Angemeldet, nicht gekommen',
        value: count((row) => row.registration === 'registered' && row.state === 'missing'),
        tone: 'bad',
      },
      { label: 'Abgemeldet', value: count((row) => row.state === 'excused'), tone: '' },
    ];
  });

  protected readonly addable = computed(() => {
    const session = this.session();
    if (!session) return [];
    const listed = new Set(this.store.attendees(session).map(({ person }) => person.id));
    return this.store.people().filter((person) => !listed.has(person.id));
  });

  protected set(row: AttendanceRow, state: AttendanceState): void {
    const session = this.session();
    if (session) this.store.setAttendance(session.id, row.person.id, row.role, state);
  }

  protected add(person: Person): void {
    const session = this.session();
    if (session) this.store.addWithoutRegistration(session.id, person);
    this.adding.set(false);
  }

  protected exportExcel(): void {
    const session = this.session();
    if (!session) return;
    const lines = [
      ['Name', 'Gruppe', 'Anmeldung', 'Anwesenheit'],
      ...this.rows().map((row) => [
        row.person.name,
        row.group,
        row.registration === 'none'
          ? ''
          : row.registration === 'registered'
            ? 'angemeldet'
            : 'abgemeldet',
        WORDS[row.state],
      ]),
    ];
    const content = '﻿' + lines.map((line) => line.join(';')).join('\r\n');
    downloadText(`Anwesenheit_${session.date}_${session.time.replace(':', '')}.csv`, content);
  }
}
