import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';
import { MailDialog } from './mail-dialog';
import { ModalDialog } from './modal-dialog';
import { RegisteredDialog } from './registered-dialog';
import { fullDate, weekdayLong } from './training-dates';
import {
  DECLINE_REASONS,
  DeclineReason,
  Person,
  PersonRole,
  SessionResponse,
  TrainingSession,
} from './training.models';
import { TrainingStore } from './training.store';

interface Row {
  session: TrainingSession;
  role: PersonRole;
  response?: SessionResponse;
}

interface DeclineTarget {
  session: TrainingSession;
  role: PersonRole;
}

@Component({
  selector: 'app-training-registration',
  imports: [RouterLink, Icon, ModalDialog, RegisteredDialog, MailDialog],
  templateUrl: './registration.html',
})
export class TrainingRegistration {
  protected readonly store = inject(TrainingStore);
  protected readonly reasons = DECLINE_REASONS;
  protected readonly weekdayLong = weekdayLong;
  protected readonly fullDate = fullDate;

  private readonly selectedId = signal('');
  protected readonly message = signal('');
  protected readonly declining = signal<DeclineTarget | null>(null);
  protected readonly otherReason = signal(false);
  protected readonly note = signal('');
  protected readonly viewing = signal<TrainingSession | null>(null);
  protected readonly mailing = signal<TrainingSession | null>(null);

  /** The person whose registrations are shown (a child for parents). */
  protected readonly person = computed<Person | undefined>(() => {
    const actors = this.store.actors();
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
      if (person.role === 'swimmer') {
        const belongs =
          (person.groupId !== null && session.groupIds.includes(person.groupId)) ||
          session.extraSwimmerIds.includes(person.id);
        if (!belongs) continue;
        const response = this.store.responseOf(session.id, person.id, 'swimmer');
        if (response) reported.push({ session, role: 'swimmer', response });
        else if (this.store.deadlineOpen(session)) open.push({ session, role: 'swimmer' });
      } else if (session.trainerIds.includes(person.id)) {
        const response = this.store.responseOf(session.id, person.id, 'trainer');
        if (response) reported.push({ session, role: 'trainer', response });
        else trainerOpen.push({ session, role: 'trainer' });
      }
    }
    return { reported, open, trainerOpen };
  });

  constructor() {
    // Reset the selection when the demo role changes.
    effect(() => {
      this.store.role();
      this.selectedId.set('');
    });
  }

  protected select(id: string): void {
    this.selectedId.set(id);
  }

  protected groupNames(session: TrainingSession): string {
    return session.groupIds.map((id) => this.store.groupName(id)).join(', ');
  }

  protected mailRecipients(session: TrainingSession): string[] {
    const registered = this.store.registered(session);
    return [...registered.trainers, ...registered.swimmers].map((person) => person.name);
  }

  protected register(row: Row): void {
    const person = this.person();
    if (!person) return;
    this.store.respond(row.session.id, person.id, row.role, 'registered');
  }

  protected startDecline(row: Row): void {
    this.declining.set({ session: row.session, role: row.role });
    this.otherReason.set(false);
    this.note.set('');
  }

  protected decline(reason: DeclineReason): void {
    const target = this.declining();
    const person = this.person();
    if (!target || !person) return;
    this.store.respond(
      target.session.id,
      person.id,
      target.role,
      'declined',
      reason,
      reason === 'Sonstiges' ? this.note() : undefined,
    );
    this.declining.set(null);
    this.message.set(`${person.name} wurde abgemeldet.`);
  }

  protected chooseReason(reason: DeclineReason): void {
    if (reason === 'Sonstiges') this.otherReason.set(true);
    else this.decline(reason);
  }

  protected setNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }
}
