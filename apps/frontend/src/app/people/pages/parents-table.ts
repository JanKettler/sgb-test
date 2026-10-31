import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../ui/icon';
import { SortButton, SortState } from '../../ui/sort';
import { TablePager, pageOf } from '../../ui/table-pager';
import { Toasts } from '../../ui/toast';
import { ModalDialog } from '../../ui/modal-dialog';
import { Parent, fullName } from '../people.models';
import { PeopleStore } from '../people.store';

/** Parents and guardians with the children they register. */
@Component({
  selector: 'app-parents-table',
  imports: [RouterLink, Icon, ModalDialog, SortButton, TablePager],
  styles: `
    .icon-row {
      gap: 0.5rem;

      .button {
        font-size: 0.85rem;
        height: 2.2rem;
        min-width: 2.2rem;
        padding: 0;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './parents-table.html',
})
export class ParentsTable {
  private readonly store = inject(PeopleStore);
  private readonly toasts = inject(Toasts);

  protected readonly toDelete = signal<Parent | null>(null);

  protected readonly sort = new SortState('name');
  protected readonly page = signal(0);
  protected readonly size = signal(25);

  protected readonly rows = computed(() => {
    const key = this.sort.key();
    const compare = (a: Parent, b: Parent): number => {
      if (key === 'relation') return a.relation.localeCompare(b.relation, 'de');
      if (key === 'email') return a.email.localeCompare(b.email, 'de');
      if (key === 'member') return (a.memberNo ?? 0) - (b.memberNo ?? 0);
      if (key === 'access') return a.access.localeCompare(b.access);
      return a.name.localeCompare(b.name, 'de');
    };
    return [...this.store.parents()]
      .sort((a, b) => this.sort.apply(compare(a, b)))
      .map((parent) => ({
        parent,
        children: this.store.childrenOf(parent).map((child) => ({
          id: child.id,
          name: fullName(child),
        })),
      }));
  });

  protected readonly pageRows = computed(() => pageOf(this.rows(), this.page(), this.size()));

  protected remove(parent: Parent): void {
    this.store.deleteParent(parent.id);
    this.toDelete.set(null);
    this.toasts.saved(`${parent.name} gelöscht`);
  }
}
