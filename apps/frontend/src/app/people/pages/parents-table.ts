import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PeopleStore } from '../people.store';
import { fullName } from '../people.models';

/** Parents and guardians with the children they register. */
@Component({
  selector: 'app-parents-table',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './parents-table.html',
})
export class ParentsTable {
  private readonly store = inject(PeopleStore);

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
}
