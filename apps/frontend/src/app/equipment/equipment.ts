import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TabDef, Tabs } from '../ui/tabs';
import { EquipmentStore } from './equipment.store';
import { BadgesTab } from './pages/badges-tab';
import { ItemsTab } from './pages/items-tab';
import { LoansTab } from './pages/loans-tab';
import { ShoppingTab } from './pages/shopping-tab';

/** Material of the club: items with stock, lending, the shopping list and the badge stock. */
@Component({
  selector: 'app-equipment',
  imports: [Tabs, ItemsTab, LoansTab, ShoppingTab, BadgesTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './equipment.html',
})
export class Equipment {
  private readonly store = inject(EquipmentStore);
  protected readonly tab = signal('items');
  protected readonly tabs = computed<TabDef[]>(() => [
    { id: 'items', label: 'Gegenstände' },
    { id: 'loans', label: 'Ausgabe & Verleih', count: this.store.overdueCount() },
    { id: 'shopping', label: 'Einkaufsliste', count: this.store.shopping().length },
    { id: 'badges', label: 'Abzeichen', count: this.store.lowBadges().length },
  ]);
}
