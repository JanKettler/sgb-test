import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { ModalDialog } from '../../ui/modal-dialog';
import { shortDay } from '../training-dates';
import { DeclineReason, OTHER_REASON, TrainingSession } from '../training.models';
import { TrainingStore } from '../training.store';

export interface DeclineChoice {
  reason: DeclineReason;
  note: string;
}

/** Asks why somebody cannot come. Every reason except "Sonstiges" declines right away. */
@Component({
  selector: 'app-decline-dialog',
  imports: [ModalDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './decline-dialog.html',
  styleUrl: './decline-dialog.scss',
})
export class DeclineDialog {
  protected readonly store = inject(TrainingStore);
  protected readonly other = OTHER_REASON;
  protected readonly otherSelected = signal(false);
  protected readonly note = signal('');

  readonly session = input.required<TrainingSession>();
  readonly chosen = output<DeclineChoice>();
  readonly closed = output();

  protected subtitle(): string {
    const session = this.session();
    return `${shortDay(session.date)}, ${session.time} · ${this.store.groupNames(session)}`;
  }

  protected choose(reason: DeclineReason): void {
    if (reason === OTHER_REASON) this.otherSelected.set(true);
    else this.chosen.emit({ reason, note: '' });
  }

  protected setNote(event: Event): void {
    this.note.set((event.target as HTMLInputElement).value);
  }
}
