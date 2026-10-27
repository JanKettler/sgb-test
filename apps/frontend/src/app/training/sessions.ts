import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';
import { MailDialog } from './mail-dialog';
import { ModalDialog } from './modal-dialog';
import { RegisteredDialog } from './registered-dialog';
import { endTime, shortDay } from './training-dates';
import { GroupId, TrainingSession } from './training.models';
import { RepeatOptions, TrainingStore } from './training.store';

const WEEKDAY_CHOICES: readonly { index: number; label: string }[] = [
  { index: 1, label: 'Mo' },
  { index: 2, label: 'Di' },
  { index: 3, label: 'Mi' },
  { index: 4, label: 'Do' },
  { index: 5, label: 'Fr' },
  { index: 6, label: 'Sa' },
  { index: 0, label: 'So' },
];

@Component({
  selector: 'app-sessions',
  imports: [RouterLink, Icon, ModalDialog, MailDialog, RegisteredDialog],
  templateUrl: './sessions.html',
})
export class Sessions {
  protected readonly store = inject(TrainingStore);
  protected readonly weekdayChoices = WEEKDAY_CHOICES;
  protected readonly shortDay = shortDay;
  protected readonly endTime = endTime;

  protected readonly showPast = signal(false);
  protected readonly message = signal('');
  protected readonly draft = signal<TrainingSession | null>(null);
  protected readonly invalid = signal(false);
  protected readonly repeatSeries = signal(false);
  protected readonly rhythm = signal<RepeatOptions['rhythm']>('weekly');
  protected readonly until = signal('');
  protected readonly weekdays = signal<number[]>([]);
  protected readonly toDelete = signal<TrainingSession | null>(null);
  protected readonly viewing = signal<TrainingSession | null>(null);
  protected readonly mailing = signal<TrainingSession | null>(null);
  protected readonly trainerToAdd = signal('');
  protected readonly swimmerToAdd = signal('');

  protected readonly visibleSessions = computed(() => {
    const today = this.store.today;
    return this.store.sessions().filter((session) => this.showPast() || session.date >= today);
  });

  protected readonly trainerChoices = computed(() => {
    const draft = this.draft();
    if (!draft) return [];
    const byGroup = this.store.trainersForGroups(draft.groupIds);
    const extras = this.store.trainers().filter((t) => draft.trainerIds.includes(t.id));
    return [...new Map([...byGroup, ...extras].map((t) => [t.id, t])).values()];
  });

  protected readonly otherTrainers = computed(() => {
    const ids = new Set(this.trainerChoices().map((t) => t.id));
    return this.store.trainers().filter((trainer) => !ids.has(trainer.id));
  });

  protected readonly otherSwimmers = computed(() => {
    const draft = this.draft();
    if (!draft) return [];
    return this.store
      .swimmers()
      .filter(
        (swimmer) =>
          !draft.extraSwimmerIds.includes(swimmer.id) &&
          !(swimmer.groupId !== null && draft.groupIds.includes(swimmer.groupId)),
      );
  });

  protected groupNames(session: TrainingSession): string {
    return session.groupIds.map((id) => this.store.groupName(id)).join(', ');
  }

  protected trainerNames(session: TrainingSession): string {
    return session.trainerIds.map((id) => this.store.personName(id)).join(', ');
  }

  protected mailRecipients(session: TrainingSession): string[] {
    const registered = this.store.registered(session);
    return [...registered.trainers, ...registered.swimmers].map((person) => person.name);
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected setRhythm(event: Event): void {
    this.rhythm.set(this.value(event) as RepeatOptions['rhythm']);
  }

  protected openNew(): void {
    this.startEditing(this.store.emptySession());
  }

  protected openEdit(session: TrainingSession): void {
    this.startEditing({
      ...session,
      groupIds: [...session.groupIds],
      trainerIds: [...session.trainerIds],
      extraSwimmerIds: [...session.extraSwimmerIds],
    });
  }

  protected openCopy(session: TrainingSession): void {
    const copy = this.store.copySession(session.id);
    if (copy) this.startEditing(copy);
  }

  private startEditing(session: TrainingSession): void {
    this.draft.set(session);
    this.invalid.set(false);
    this.repeatSeries.set(false);
    this.rhythm.set('weekly');
    this.until.set('');
    this.weekdays.set([]);
    this.trainerToAdd.set('');
    this.swimmerToAdd.set('');
  }

  protected closeEditor(): void {
    this.draft.set(null);
  }

  protected patch(change: Partial<TrainingSession>): void {
    this.draft.update((current) => (current ? { ...current, ...change } : current));
  }

  protected toggleGroup(groupId: GroupId): void {
    const draft = this.draft();
    if (!draft) return;
    const groupIds = draft.groupIds.includes(groupId)
      ? draft.groupIds.filter((id) => id !== groupId)
      : [...draft.groupIds, groupId];
    if (groupIds.length === 0) return;
    // Trainers follow the chosen groups, except those that were added manually.
    const previous = new Set(this.store.trainersForGroups(draft.groupIds).map((t) => t.id));
    const manual = draft.trainerIds.filter((id) => !previous.has(id));
    const trainerIds = [
      ...new Set([...this.store.trainersForGroups(groupIds).map((t) => t.id), ...manual]),
    ];
    this.patch({ groupIds, trainerIds });
  }

  protected toggleTrainer(id: string): void {
    const draft = this.draft();
    if (!draft) return;
    this.patch({
      trainerIds: draft.trainerIds.includes(id)
        ? draft.trainerIds.filter((item) => item !== id)
        : [...draft.trainerIds, id],
    });
  }

  protected addTrainer(): void {
    const draft = this.draft();
    const id = this.trainerToAdd();
    if (!draft || !id) return;
    this.patch({ trainerIds: [...new Set([...draft.trainerIds, id])] });
    this.trainerToAdd.set('');
  }

  protected addSwimmer(): void {
    const draft = this.draft();
    const id = this.swimmerToAdd();
    if (!draft || !id) return;
    this.patch({ extraSwimmerIds: [...new Set([...draft.extraSwimmerIds, id])] });
    this.swimmerToAdd.set('');
  }

  protected removeSwimmer(id: string): void {
    const draft = this.draft();
    if (!draft) return;
    this.patch({ extraSwimmerIds: draft.extraSwimmerIds.filter((item) => item !== id) });
  }

  protected toggleWeekday(index: number): void {
    this.weekdays.update((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
  }

  protected save(asCopy: boolean): void {
    const draft = this.draft();
    if (!draft) return;
    if (!draft.date || !draft.time || draft.groupIds.length === 0) {
      this.invalid.set(true);
      return;
    }
    const session = asCopy ? { ...draft, id: '' } : draft;
    const series = this.repeatSeries() && !session.id && this.until() !== '';
    const repeat: RepeatOptions | null = series
      ? { rhythm: this.rhythm(), until: this.until(), weekdays: this.weekdays() }
      : null;
    const count = this.store.saveSession(session, repeat);
    this.message.set(
      count > 1 ? `${count} Termine wurden angelegt.` : 'Der Termin wurde gespeichert.',
    );
    this.draft.set(null);
  }

  protected confirmDelete(): void {
    const session = this.toDelete();
    if (!session) return;
    this.store.deleteSession(session.id);
    this.toDelete.set(null);
    this.message.set('Der Termin wurde gelöscht.');
  }
}
