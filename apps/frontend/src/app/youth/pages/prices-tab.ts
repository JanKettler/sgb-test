import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { euro } from '../../competition/competition.models';
import { isBadgeLow } from '../../equipment/equipment.models';
import { EquipmentStore } from '../../equipment/equipment.store';
import { Action } from '../../ui/action';
import { FieldDef, FormDialog, FormValues, listOf, numberOf, textOf } from '../../ui/form-dialog';
import { Toasts } from '../../ui/toast';
import { BadgeKind } from '../youth.models';
import { YouthStore } from '../youth.store';

const KIND_FIELDS: readonly FieldDef[] = [
  { key: 'price', label: 'Preis (€)', type: 'number' },
  {
    key: 'requirements',
    label: 'Anforderungen',
    type: 'lines',
    rows: 8,
    hint: 'Pro Zeile eine Anforderung. Sie werden bei der Abnahme abgehakt.',
  },
];

const NEW_FIELDS: readonly FieldDef[] = [
  { key: 'name', label: 'Name', required: true },
  ...KIND_FIELDS,
];

/** Prices and requirements of the badges; the stock itself is kept on the material page. */
@Component({
  selector: 'app-youth-prices',
  imports: [Action, FormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prices-tab.html',
})
export class PricesTab {
  protected readonly store = inject(YouthStore);
  private readonly equipment = inject(EquipmentStore);
  private readonly toasts = inject(Toasts);
  protected readonly euro = euro;
  protected readonly newFields = NEW_FIELDS;
  protected readonly kindFields = KIND_FIELDS;

  protected readonly editing = signal<BadgeKind | null>(null);
  protected readonly adding = signal(false);
  protected readonly newKind = { name: '', price: 0, requirements: [] };

  /** The stock of every badge by name, from the material page. */
  protected readonly stock = computed(
    () => new Map(this.equipment.badges().map((badge) => [badge.name, badge])),
  );

  protected stockText(name: string): string {
    const stock = this.stock().get(name)?.stock;
    return stock === null || stock === undefined ? '–' : String(stock);
  }

  protected low(name: string): boolean {
    const badge = this.stock().get(name);
    return badge ? isBadgeLow(badge) : false;
  }

  protected save(values: FormValues): void {
    const current = this.editing();
    if (!current) return;
    this.store.saveKind({
      name: current.name,
      price: Math.max(0, numberOf(values, 'price')),
      requirements: listOf(values, 'requirements'),
    });
    this.toasts.saved('Preis und Anforderungen gespeichert');
    this.editing.set(null);
  }

  protected add(values: FormValues): void {
    const problem = this.store.addKind({
      name: textOf(values, 'name'),
      price: Math.max(0, numberOf(values, 'price')),
      requirements: listOf(values, 'requirements'),
    });
    if (problem) {
      this.toasts.failed(problem);
      return;
    }
    this.toasts.saved('Abzeichen angelegt');
    this.adding.set(false);
  }
}
