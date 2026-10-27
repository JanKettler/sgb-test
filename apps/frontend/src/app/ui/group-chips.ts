import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { GroupId } from '../training/training.models';
import { TrainingStore } from '../training/training.store';

/** Coloured chips for training groups. */
@Component({
  selector: 'app-group-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (id of groupIds(); track id) {
      <span class="group-chip" [class]="'group-chip grp-' + id">{{ store.groupName(id) }}</span>
    }
  `,
})
export class GroupChips {
  protected readonly store = inject(TrainingStore);
  readonly groupIds = input.required<GroupId[]>();
}
