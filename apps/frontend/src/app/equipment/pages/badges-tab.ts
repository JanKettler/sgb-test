import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Action } from '../../ui/action';
import { FieldDef, FormDialog, FormValues, textOf } from '../../ui/form-dialog';
import { Icon } from '../../ui/icon';
import { Toasts } from '../../ui/toast';
import { BadgeStock, isBadgeLow } from '../equipment.models';
import { EquipmentStore } from '../equipment.store';

const FIELDS: readonly FieldDef[] = [
  {
    key: 'stock',
    label: 'Bestand (Stück)',
    type: 'number',
    hint: 'Leer lassen, wenn der Bestand nicht geführt wird.',
  },
  {
    key: 'minimum',
    label: 'Nachbestellen ab (Stück)',
    type: 'number',
    hint: 'Leer lassen für keinen Hinweis.',
  },
];

/** A number from a form field; null when the field is empty. */
function countOf(values: FormValues, key: string): number | null {
  const text = textOf(values, key).replace(',', '.');
  const number = Number(text);
  return text === '' || !Number.isFinite(number) ? null : Math.max(0, Math.round(number));
}

/** Stock of the badges for the youth: a tile per badge, with a hint when it runs low. */
@Component({
  selector: 'app-equipment-badges',
  imports: [Action, FormDialog, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './badges-tab.html',
})
export class BadgesTab {
  protected readonly isLow = isBadgeLow;
  protected readonly store = inject(EquipmentStore);
  private readonly toasts = inject(Toasts);
  protected readonly fields = FIELDS;
  protected readonly editing = signal<BadgeStock | null>(null);

  /** The longest bar is the biggest stock, but never less than ten pieces. */
  protected readonly top = computed(() =>
    this.store
      .badges()
      .reduce((most, badge) => Math.max(most, badge.stock ?? 0, (badge.minimum ?? 0) * 2), 10),
  );

  protected save(values: FormValues): void {
    const badge = this.editing();
    if (badge) {
      this.store.saveBadge({
        name: badge.name,
        stock: countOf(values, 'stock'),
        minimum: countOf(values, 'minimum'),
      });
      this.toasts.saved('Bestand gespeichert');
    }
    this.editing.set(null);
  }
}
