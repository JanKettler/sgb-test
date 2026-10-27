import { Component, inject, input, output } from '@angular/core';
import { Icon } from './icon';
import { ModalDialog } from './modal-dialog';
import { shortDay } from './training-dates';
import { TrainingSession } from './training.models';
import { TrainingStore } from './training.store';

const VISIBLE_SWIMMERS = 12;

/** Lists everybody who registered for a session: trainers first, then swimmers. */
@Component({
  selector: 'app-registered-dialog',
  imports: [Icon, ModalDialog],
  templateUrl: './registered-dialog.html',
})
export class RegisteredDialog {
  protected readonly store = inject(TrainingStore);
  protected readonly shortDay = shortDay;
  protected readonly visibleSwimmers = VISIBLE_SWIMMERS;

  readonly session = input.required<TrainingSession>();
  readonly closed = output<void>();
  readonly mail = output<void>();
}
