import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { downloadXlsx } from '../../competition/competition-download';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { Toasts } from '../../ui/toast';
import { shoppingBook } from '../equipment.export';
import { EquipmentItem, availableOf, isLow, missingOf } from '../equipment.models';
import { EquipmentStore } from '../equipment.store';

/** Everything that is below its minimum or was put on the list by hand. */
@Component({
  selector: 'app-equipment-shopping',
  imports: [Action, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shopping-tab.html',
})
export class ShoppingTab {
  protected readonly store = inject(EquipmentStore);
  private readonly toasts = inject(Toasts);
  protected readonly availableOf = availableOf;
  protected readonly isLow = isLow;
  protected readonly missingOf = missingOf;
  protected readonly bought = signal<EquipmentItem | null>(null);

  protected confirmText(item: EquipmentItem): string {
    const missing = missingOf(item);
    return missing > 0
      ? `Der Bestand wird um ${missing} auf ${item.stock + missing} ${item.unit} erhöht, der Gegenstand verschwindet von der Liste.`
      : 'Der Gegenstand verschwindet von der Liste, der Bestand bleibt unverändert.';
  }

  protected confirmBought(): void {
    const item = this.bought();
    if (item) {
      this.store.bought(item.id);
      this.toasts.saved('Als gekauft eingetragen');
    }
    this.bought.set(null);
  }

  protected exportExcel(): void {
    if (this.store.shopping().length === 0) {
      this.toasts.show('Es gibt nichts nachzukaufen.', 'info');
      return;
    }
    downloadXlsx(
      'Einkaufsliste_Material.xlsx',
      shoppingBook(this.store.shopping(), this.store.today),
    );
  }
}
