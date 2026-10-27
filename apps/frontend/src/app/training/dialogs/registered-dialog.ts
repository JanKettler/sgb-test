import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ModalDialog } from '../../ui/modal-dialog';
import { shortDay } from '../training-dates';
import { TrainingSession } from '../training.models';
import { TrainingStore } from '../training.store';

const VISIBLE_SWIMMERS = 8;

/** Lists everybody who registered for a session: trainers first, then swimmers. */
@Component({
  selector: 'app-registered-dialog',
  imports: [ModalDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './registered-dialog.html',
  styleUrl: './registered-dialog.scss',
})
export class RegisteredDialog {
  private readonly store = inject(TrainingStore);
  protected readonly canMail = this.store.canManage;

  readonly session = input.required<TrainingSession>();
  readonly closed = output();
  readonly mail = output();

  protected readonly view = computed(() => {
    const session = this.session();
    const { trainers, swimmers } = this.store.registered(session);
    return {
      badge: `${swimmers.length} von ${session.maxSwimmers}`,
      subtitle: `${shortDay(session.date)}, ${session.time} · ${this.store.groupNames(session)}`,
      trainers,
      swimmers: swimmers.slice(0, VISIBLE_SWIMMERS),
      more: Math.max(swimmers.length - VISIBLE_SWIMMERS, 0),
    };
  });
}
