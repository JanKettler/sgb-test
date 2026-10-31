import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../../ui/icon';
import { Toasts } from '../../../ui/toast';
import { DeclineChoice, DeclineDialog } from '../../dialogs/decline-dialog';
import { MailDialog } from '../../dialogs/mail-dialog';
import { RegisteredDialog } from '../../dialogs/registered-dialog';
import { endTime, fullDate, weekdayLong } from '../../training-dates';
import {
  GroupId,
  Person,
  PersonRole,
  SessionResponse,
  TrainingSession,
} from '../../training.models';
import { TrainingStore } from '../../training.store';

interface Row {
  session: TrainingSession;
  role: PersonRole;
  date: string;
  weekday: string;
  time: string;
  groups: string;
  deadline: string;
  response?: SessionResponse;
  canTakeAttendance: boolean;
}

interface DeclineTarget {
  session: TrainingSession;
  role: PersonRole;
}

@Component({
  selector: 'app-training-registration',
  imports: [RouterLink, Icon, DeclineDialog, RegisteredDialog, MailDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './registration.html',
  styleUrl: './registration.scss',
})
export class TrainingRegistration {
  protected readonly store = inject(TrainingStore);
  protected readonly toasts = inject(Toasts);
  protected readonly actors = this.store.actors;

  private readonly selectedId = signal('');
  protected readonly declining = signal<DeclineTarget | null>(null);
  protected readonly viewing = signal<TrainingSession | null>(null);
  protected readonly mailing = signal<TrainingSession | null>(null);

  /** The groups a person swims in or trains, as plain text next to the name. */
  protected groupNamesOf(person: Person): string {
    const ids: GroupId[] = [...(person.groupId ? [person.groupId] : []), ...person.trainerGroupIds];
    return ids.map((id) => this.store.groupName(id)).join(', ');
  }

  protected value(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  /** The person whose registrations are shown, for parents one of the children. */
  protected readonly person = computed(() => {
    const actors = this.actors();
    return actors.find((actor) => actor.id === this.selectedId()) ?? actors[0];
  });

  protected readonly rows = computed(() => {
    const person = this.person();
    const reported: Row[] = [];
    const open: Row[] = [];
    const trainerOpen: Row[] = [];
    if (!person) return { reported, open, trainerOpen };
    for (const session of this.store.sessions()) {
      if (session.date < this.store.today) continue;
      const role = this.store.roleIn(session, person);
      if (!role) continue;
      const response = this.store.responseOf(session.id, person.id, role);
      const row: Row = {
        session,
        role,
        response,
        date: fullDate(session.date),
        weekday: session.date === this.store.today ? 'Heute' : weekdayLong(session.date),
        time: `${session.time} - ${endTime(session.time, session.durationMinutes)}`,
        groups: this.store.groupNames(session),
        deadline: this.store.deadlineLabel(session),
        canTakeAttendance:
          role === 'trainer' && this.store.canManage() && this.store.attendanceStarted(session),
      };
      if (response) reported.push(row);
      else if (role === 'trainer') trainerOpen.push(row);
      else if (this.store.deadlineOpen(session)) open.push(row);
    }
    return { reported, open, trainerOpen };
  });

  constructor() {
    // Start again with the first person when the demo role changes.
    effect(() => {
      this.store.role();
      this.selectedId.set('');
    });
  }

  protected select(id: string): void {
    this.selectedId.set(id);
  }

  protected mailRecipients(session: TrainingSession): string[] {
    const { trainers, swimmers } = this.store.registered(session);
    return [...trainers, ...swimmers].map((person) => person.name);
  }

  protected register(row: Row): void {
    const person = this.person();
    if (!person) return;
    this.store.respond(row.session.id, person.id, row.role, 'registered');
    this.toasts.show(`${person.name} ist angemeldet`);
  }

  protected decline(choice: DeclineChoice): void {
    const target = this.declining();
    const person = this.person();
    if (!target || !person) return;
    const { session, role } = target;
    this.store.respond(session.id, person.id, role, 'declined', choice.reason, choice.note);
    this.declining.set(null);
    this.toasts.show(`${person.name} wurde abgemeldet`);
  }
}
