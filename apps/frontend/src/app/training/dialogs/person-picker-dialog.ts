import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ModalDialog } from '../../ui/modal-dialog';
import { Person } from '../training.models';
import { TrainingStore } from '../training.store';

/** Search and pick one person, e.g. an extra trainer for a single session. */
@Component({
  selector: 'app-person-picker-dialog',
  imports: [ModalDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './person-picker-dialog.html',
  styleUrl: './person-picker-dialog.scss',
})
export class PersonPickerDialog {
  private readonly store = inject(TrainingStore);
  private readonly query = signal('');

  readonly heading = input.required<string>();
  readonly candidates = input.required<Person[]>();
  readonly picked = output<Person>();
  readonly closed = output();

  protected readonly matches = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.candidates()
      .filter((person) => person.name.toLowerCase().includes(query))
      .map((person) => ({
        person,
        detail: person.groupId ? this.store.groupName(person.groupId) : 'Trainer',
      }));
  });

  protected setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
