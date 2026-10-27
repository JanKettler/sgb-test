import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Icon } from '../../../ui/icon';
import { PersonPickerDialog } from '../../dialogs/person-picker-dialog';
import { dayMonth, fullDate, shortDay, weekdayIndex } from '../../training-dates';
import { GroupId, Person, TrainingSession } from '../../training.models';
import { RepeatOptions, TrainingStore } from '../../training.store';

const WEEKDAYS: readonly { index: number; label: string }[] = [
  { index: 1, label: 'Mo' },
  { index: 2, label: 'Di' },
  { index: 3, label: 'Mi' },
  { index: 4, label: 'Do' },
  { index: 5, label: 'Fr' },
  { index: 6, label: 'Sa' },
  { index: 0, label: 'So' },
];

const RHYTHMS: readonly { id: RepeatOptions['rhythm']; label: string }[] = [
  { id: 'weekly', label: 'Jede Woche' },
  { id: 'biweekly', label: 'Jede zweite Woche' },
  { id: 'monthly', label: 'Einmal im Monat' },
];

type Picker = 'trainer' | 'swimmer' | null;

/** Edit, copy or create a session, optionally as a series. */
@Component({
  selector: 'app-session-editor',
  imports: [RouterLink, Icon, PersonPickerDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-editor.html',
  styleUrl: './session-editor.scss',
})
export class SessionEditor {
  protected readonly store = inject(TrainingStore);
  private readonly router = inject(Router);
  protected readonly weekdays = WEEKDAYS;
  protected readonly rhythms = RHYTHMS;

  protected readonly draft = signal<TrainingSession>(this.initialDraft());
  protected readonly invalid = signal(false);
  protected readonly series = signal(inject(ActivatedRoute).snapshot.queryParamMap.has('serie'));
  protected readonly rhythm = signal<RepeatOptions['rhythm']>('weekly');
  protected readonly until = signal('');
  protected readonly repeatDays = signal<number[]>([weekdayIndex(this.draft().date)]);
  protected readonly picker = signal<Picker>(null);

  protected readonly isNew = computed(() => this.draft().id === '');

  protected readonly title = computed(() => {
    const draft = this.draft();
    const names = draft.groupIds.map((id) => this.store.groupName(id)).join(', ');
    return `${draft.date ? shortDay(draft.date) : ''} · ${names}`;
  });

  /** Trainers of the selected groups; the others were added for this session only. */
  protected readonly groupTrainers = computed(() =>
    this.store.trainersForGroups(this.draft().groupIds),
  );

  protected readonly extraTrainers = computed(() => {
    const regular = new Set(this.groupTrainers().map((trainer) => trainer.id));
    return this.draft()
      .trainerIds.filter((id) => !regular.has(id))
      .map((id) => this.store.person(id))
      .filter((person): person is Person => !!person);
  });

  protected readonly extraSwimmers = computed(() =>
    this.draft()
      .extraSwimmerIds.map((id) => this.store.person(id))
      .filter((person): person is Person => !!person),
  );

  /** Trainers who would also swim in the selected groups. */
  protected readonly doubleRole = computed(() => {
    const groups = this.draft().groupIds;
    return this.store
      .swimmers()
      .filter((person) => groups.includes(person.groupId as GroupId))
      .filter((person) => this.draft().trainerIds.includes(person.id))
      .map((person) => person.name);
  });

  protected readonly pickerCandidates = computed(() => {
    const draft = this.draft();
    if (this.picker() === 'trainer') {
      return this.store.people().filter((person) => !draft.trainerIds.includes(person.id));
    }
    return this.store
      .swimmers()
      .filter(
        (person) =>
          !draft.extraSwimmerIds.includes(person.id) &&
          !draft.groupIds.includes(person.groupId as GroupId),
      );
  });

  protected readonly repeatDates = computed(() => {
    if (!this.series() || !this.isNew() || !this.until()) return [];
    return this.store.repeatDates(this.draft().date, {
      rhythm: this.rhythm(),
      until: this.until(),
      weekdays: this.repeatDays(),
    });
  });

  protected readonly repeatSummary = computed(() => {
    const dates = this.repeatDates();
    if (dates.length === 0) return '';
    const last = dates[dates.length - 1];
    return `Ergebnis: ${dates.length} Termine zwischen ${dayMonth(dates[0])} und ${fullDate(last)}`;
  });

  private initialDraft(): TrainingSession {
    const snapshot = inject(ActivatedRoute).snapshot;
    const id = snapshot.paramMap.get('id');
    const copyOf = snapshot.queryParamMap.get('kopie');
    const existing = id ? this.store.findSession(id) : undefined;
    const source = copyOf ? this.store.findSession(copyOf) : undefined;
    if (existing) return this.clone(existing);
    if (source) return this.store.copyOf(source);
    return this.store.emptySession();
  }

  private clone(session: TrainingSession): TrainingSession {
    return {
      ...session,
      groupIds: [...session.groupIds],
      trainerIds: [...session.trainerIds],
      extraSwimmerIds: [...session.extraSwimmerIds],
    };
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected patch(change: Partial<TrainingSession>): void {
    this.draft.update((current) => ({ ...current, ...change }));
  }

  protected toggleGroup(groupId: GroupId): void {
    const draft = this.draft();
    const groupIds = draft.groupIds.includes(groupId)
      ? draft.groupIds.filter((id) => id !== groupId)
      : [...draft.groupIds, groupId];
    if (groupIds.length === 0) return;
    // Trainers follow the chosen groups; people added by hand stay.
    const before = new Set(this.groupTrainers().map((trainer) => trainer.id));
    const manual = draft.trainerIds.filter((id) => !before.has(id));
    const trainerIds = this.store.trainersForGroups(groupIds).map((trainer) => trainer.id);
    this.patch({ groupIds, trainerIds: [...new Set([...trainerIds, ...manual])] });
  }

  protected toggleTrainer(id: string): void {
    const draft = this.draft();
    this.patch({
      trainerIds: draft.trainerIds.includes(id)
        ? draft.trainerIds.filter((item) => item !== id)
        : [...draft.trainerIds, id],
    });
  }

  protected removeExtraSwimmer(id: string): void {
    this.patch({ extraSwimmerIds: this.draft().extraSwimmerIds.filter((item) => item !== id) });
  }

  protected pick(person: Person): void {
    const draft = this.draft();
    if (this.picker() === 'trainer') {
      this.patch({ trainerIds: [...new Set([...draft.trainerIds, person.id])] });
    } else {
      this.patch({ extraSwimmerIds: [...new Set([...draft.extraSwimmerIds, person.id])] });
    }
    this.picker.set(null);
  }

  protected toggleDay(index: number): void {
    this.repeatDays.update((days) =>
      days.includes(index) ? days.filter((day) => day !== index) : [...days, index],
    );
  }

  protected setRhythm(event: Event): void {
    this.rhythm.set(this.value(event) as RepeatOptions['rhythm']);
  }

  protected save(asCopy: boolean): void {
    const draft = this.draft();
    if (!draft.date || !draft.time || draft.groupIds.length === 0) {
      this.invalid.set(true);
      return;
    }
    const session = asCopy ? { ...draft, id: '' } : draft;
    const repeat: RepeatOptions | null =
      this.series() && !session.id && this.until()
        ? { rhythm: this.rhythm(), until: this.until(), weekdays: this.repeatDays() }
        : null;
    const count = this.store.saveSession(session, repeat);
    this.store.flash.set(
      count > 1 ? `${count} Termine wurden angelegt.` : 'Der Termin wurde gespeichert.',
    );
    void this.router.navigateByUrl('/training/termine');
  }
}
