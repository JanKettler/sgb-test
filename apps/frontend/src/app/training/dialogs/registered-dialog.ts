import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DialogAccent, ModalDialog } from '../../ui/modal-dialog';
import { shortDay } from '../training-dates';
import { GroupId, TrainingSession } from '../training.models';
import { TrainingStore } from '../training.store';

/** The dialog takes the colour of the first group of the session. */
const GROUP_LOOK: Record<GroupId, { accent: DialogAccent; tone: string }> = {
  G1: { accent: 'navy', tone: 'is-info' },
  G2: { accent: 'amber', tone: 'is-warn' },
  G3: { accent: 'green', tone: 'is-ok' },
  WK: { accent: 'violet', tone: 'is-violet' },
  MA: { accent: 'red', tone: 'is-bad' },
};

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
      swimmers,
      look: GROUP_LOOK[session.groupIds[0]] ?? GROUP_LOOK.G1,
    };
  });
}
