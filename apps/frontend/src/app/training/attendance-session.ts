import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Icon } from './icon';
import { downloadText } from './training-download';
import { endTime, shortDay } from './training-dates';
import { AttendanceState, Person, PersonRole } from './training.models';
import { TrainingStore } from './training.store';

const SEGMENTS: readonly { state: AttendanceState; label: string; css: string }[] = [
  { state: 'present', label: 'Anwesend', css: 'is-success' },
  { state: 'missing', label: 'Fehlt', css: 'is-danger' },
  { state: 'excused', label: 'Abgemeldet', css: 'is-warning' },
];

@Component({
  selector: 'app-attendance-session',
  imports: [RouterLink, Icon],
  templateUrl: './attendance-session.html',
})
export class AttendanceSession {
  protected readonly store = inject(TrainingStore);
  protected readonly segments = SEGMENTS;
  protected readonly shortDay = shortDay;
  protected readonly endTime = endTime;
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  protected readonly addId = signal('');

  protected readonly session = computed(() =>
    this.store.sessions().find((item) => item.id === this.params()?.get('id')),
  );

  protected readonly rows = computed(() => {
    const session = this.session();
    if (!session) return [];
    return this.store.attendees(session).map(({ person, role }) => ({
      person,
      role,
      state: this.store.stateOf(session, person.id, role),
      registered: this.store.responseOf(session.id, person.id, role)?.status,
    }));
  });

  protected readonly tiles = computed(() => {
    const rows = this.rows();
    const count = (state: AttendanceState) => rows.filter((row) => row.state === state).length;
    return [
      { label: 'Angemeldet', value: rows.filter((row) => row.registered === 'registered').length },
      { label: 'Anwesend', value: count('present') },
      { label: 'Fehlt', value: count('missing') },
      { label: 'Abgemeldet', value: count('excused') },
    ];
  });

  protected readonly addable = computed(() => {
    const session = this.session();
    if (!session) return [];
    const listed = new Set(this.store.attendees(session).map(({ person }) => person.id));
    return this.store.swimmers().filter((swimmer) => !listed.has(swimmer.id));
  });

  protected groupLabel(person: Person): string {
    return person.groupId ? this.store.groupName(person.groupId) : 'Trainer';
  }

  protected set(person: Person, role: PersonRole, state: AttendanceState): void {
    const session = this.session();
    if (session) this.store.setAttendance(session.id, person.id, role, state);
  }

  protected setAddId(event: Event): void {
    this.addId.set((event.target as HTMLSelectElement).value);
  }

  protected addPerson(): void {
    const session = this.session();
    if (!session || !this.addId()) return;
    this.store.addWalkIn(session.id, this.addId());
    this.addId.set('');
  }

  protected exportExcel(): void {
    const session = this.session();
    if (!session) return;
    const words: Record<AttendanceState, string> = {
      present: 'anwesend',
      missing: 'fehlt',
      excused: 'abgemeldet',
    };
    const lines = [
      ['Name', 'Gruppe', 'Anmeldung', 'Anwesenheit'],
      ...this.rows().map((row) => [
        row.person.name,
        this.groupLabel(row.person),
        row.registered === 'registered' ? 'angemeldet' : row.registered ? 'abgemeldet' : '',
        words[row.state],
      ]),
    ];
    const content = '﻿' + lines.map((line) => line.join(';')).join('\r\n');
    downloadText(`Anwesenheit_${session.date}_${session.time.replace(':', '')}.csv`, content);
  }
}
