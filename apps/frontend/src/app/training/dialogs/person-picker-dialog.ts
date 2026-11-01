import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Icon } from '../../ui/icon';
import { ModalDialog } from '../../ui/modal-dialog';
import { GROUPS, GroupId, Person } from '../training.models';

/** Which people are listed: everybody, one group, or the people who only train. */
type GroupFilter = 'all' | GroupId | 'trainer';

interface FilterChip {
  id: GroupFilter;
  label: string;
  count: number;
}

interface PickerEntry {
  person: Person;
  chosen: boolean;
  /** Swims in a group and also trains another one. */
  trainer: boolean;
}

interface PickerSection {
  key: GroupFilter;
  label: string;
  groupId: GroupId | null;
  entries: PickerEntry[];
}

/** Search people, filter them by group and pick one or several of them. */
@Component({
  selector: 'app-person-picker-dialog',
  imports: [Icon, ModalDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './person-picker-dialog.html',
  styleUrl: './person-picker-dialog.scss',
})
export class PersonPickerDialog {
  readonly heading = input.required<string>();
  readonly candidates = input.required<Person[]>();
  /** One sentence under the heading that says what adding the people does. */
  readonly hint = input('');
  readonly picked = output<Person[]>();
  readonly closed = output();

  private readonly query = signal('');
  protected readonly filter = signal<GroupFilter>('all');
  /** Ids of the people ticked so far; they stay ticked while the list is filtered. */
  protected readonly chosen = signal<ReadonlySet<string>>(new Set());

  /** One chip per group that still has somebody to add, with the number of people. */
  protected readonly filters = computed<FilterChip[]>(() => {
    const people = this.candidates();
    const chips: FilterChip[] = [{ id: 'all', label: 'Alle', count: people.length }];
    for (const group of GROUPS) {
      const count = people.filter((person) => person.groupId === group.id).length;
      if (count > 0) chips.push({ id: group.id, label: group.name, count });
    }
    const trainers = people.filter((person) => person.groupId === null).length;
    if (trainers > 0) chips.push({ id: 'trainer', label: 'Trainer', count: trainers });
    return chips;
  });

  protected readonly sections = computed<PickerSection[]>(() => {
    const query = this.query().trim().toLowerCase();
    const only = this.filter();
    const chosen = this.chosen();
    const people = this.candidates().filter((person) => person.name.toLowerCase().includes(query));
    const buckets: { key: GroupFilter; label: string; groupId: GroupId | null }[] = [
      ...GROUPS.map((group) => ({ key: group.id, label: group.name, groupId: group.id })),
      { key: 'trainer', label: 'Trainer', groupId: null },
    ];
    return buckets
      .filter((bucket) => only === 'all' || only === bucket.key)
      .map((bucket) => ({
        ...bucket,
        entries: people
          .filter((person) => person.groupId === bucket.groupId)
          .sort((a, b) => a.name.localeCompare(b.name, 'de'))
          .map((person) => ({
            person,
            chosen: chosen.has(person.id),
            trainer: bucket.groupId !== null && person.trainerGroupIds.length > 0,
          })),
      }))
      .filter((section) => section.entries.length > 0);
  });

  protected readonly confirmLabel = computed(() => {
    const count = this.chosen().size;
    return count > 1 ? `${count} Personen hinzufügen` : 'Hinzufügen';
  });

  protected setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected toggle(person: Person): void {
    this.chosen.update((current) => {
      const next = new Set(current);
      if (!next.delete(person.id)) next.add(person.id);
      return next;
    });
  }

  protected confirm(): void {
    const chosen = this.chosen();
    this.picked.emit(this.candidates().filter((person) => chosen.has(person.id)));
  }
}
