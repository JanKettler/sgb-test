import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../ui/icon';
import { ModalDialog } from '../../ui/modal-dialog';
import { Parent, fullName } from '../people.models';
import { PeopleStore } from '../people.store';

/** Parents and guardians with the children they register. */
@Component({
  selector: 'app-parents-table',
  imports: [RouterLink, Icon, ModalDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './parents-table.html',
})
export class ParentsTable {
  private readonly store = inject(PeopleStore);

  protected readonly toDelete = signal<Parent | null>(null);

  protected readonly rows = computed(() =>
    [...this.store.parents()]
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
      .map((parent) => ({
        parent,
        children: this.store.childrenOf(parent).map((child) => ({
          id: child.id,
          name: fullName(child),
        })),
      })),
  );

  protected remove(parent: Parent): void {
    this.store.deleteParent(parent.id);
    this.toDelete.set(null);
  }
}
