import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { downloadXlsx } from '../../competition/competition-download';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import {
  FieldDef,
  FormDialog,
  FormValues,
  flagOf,
  listOf,
  numberOf,
  textOf,
} from '../../ui/form-dialog';
import { Toasts } from '../../ui/toast';
import { fullDate } from '../../training/training-dates';
import { itemsBook } from '../equipment.export';
import {
  CONDITIONS,
  EquipmentItem,
  Loan,
  availableOf,
  conditionOf,
  isLow,
  isOverdue,
  needsBuying,
} from '../equipment.models';
import { EquipmentStore } from '../equipment.store';
import { LoanDialog } from './loan-dialog';

const FIELDS: readonly FieldDef[] = [
  { key: 'title', label: 'Name', required: true },
  { key: 'category', label: 'Kategorie', placeholder: 'z. B. Training, Wettkampf, Küche' },
  { key: 'place', label: 'Lagerort', placeholder: 'z. B. Halle, Schrank 2' },
  { key: 'stock', label: 'Bestand (gesamt)', type: 'number' },
  { key: 'minimum', label: 'Mindestbestand', type: 'number', hint: 'Leer lassen für keinen.' },
  { key: 'unit', label: 'Einheit', placeholder: 'Stück' },
  {
    key: 'condition',
    label: 'Zustand',
    type: 'select',
    options: CONDITIONS.map((condition) => ({ value: condition, label: condition })),
  },
  { key: 'toBuy', label: 'Auf die Einkaufsliste setzen', type: 'checkbox' },
  {
    key: 'pieces',
    label: 'Einzelstücke mit Nummer (optional)',
    type: 'lines',
    rows: 4,
    hint: 'Pro Zeile ein Stück, z. B. „Nr. 1“, „Nr. 2“. Dann wird jedes Stück einzeln verliehen und der Bestand ergibt sich daraus.',
  },
  { key: 'note', label: 'Notiz', type: 'textarea', rows: 2 },
];

const STOCK_FIELDS: readonly FieldDef[] = [
  { key: 'stock', label: 'Neuer Gesamtbestand', type: 'number', required: true },
];

function emptyItem(): EquipmentItem {
  return {
    id: '',
    title: '',
    category: '',
    place: '',
    stock: 1,
    minimum: null,
    unit: 'Stück',
    condition: 'gut',
    toBuy: false,
    pieces: [],
    note: '',
    loans: [],
    history: [],
  };
}

/** The list of items with stock, loans and the buttons to lend, count, edit and delete. */
@Component({
  selector: 'app-equipment-items',
  imports: [Action, FormDialog, ConfirmDialog, LoanDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './items-tab.html',
})
export class ItemsTab {
  protected readonly store = inject(EquipmentStore);
  private readonly toasts = inject(Toasts);
  protected readonly fields = FIELDS;
  protected readonly stockFields = STOCK_FIELDS;
  protected readonly isLow = isLow;
  protected readonly isOverdue = isOverdue;
  protected readonly availableOf = availableOf;
  protected readonly fullDate = fullDate;

  protected readonly query = signal('');
  protected readonly onlyBuy = signal(false);
  protected readonly onlyLent = signal(false);
  protected readonly editing = signal<EquipmentItem | null>(null);
  protected readonly toDelete = signal<EquipmentItem | null>(null);
  protected readonly counting = signal<EquipmentItem | null>(null);
  protected readonly lending = signal<EquipmentItem | null>(null);
  protected readonly changing = signal<{ item: EquipmentItem; loan: Loan } | null>(null);

  protected readonly visible = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('de');
    return this.store
      .sorted()
      .filter((item) => !this.onlyBuy() || needsBuying(item))
      .filter((item) => !this.onlyLent() || item.loans.length > 0)
      .filter(
        (item) =>
          !query ||
          `${item.title} ${item.category} ${item.place} ${item.note}`
            .toLocaleLowerCase('de')
            .includes(query),
      );
  });

  protected readonly buyCount = computed(() => this.store.items().filter(needsBuying).length);

  /** Checks the stock and the numbered pieces against what is lent at the moment. */
  protected readonly check = (values: FormValues): string => {
    const current = this.editing();
    if (!current) return '';
    const pieces = listOf(values, 'pieces');
    if (pieces.length !== new Set(pieces).size) return 'Jede Nummer darf nur einmal vorkommen.';
    const stuck = current.loans.find(
      (loan) =>
        pieces.length > 0 !== (loan.piece !== '') || (loan.piece && !pieces.includes(loan.piece)),
    );
    if (stuck) {
      return `Erst die Ausgabe an ${stuck.who} zurücknehmen, dann lässt sich die Stückliste ändern.`;
    }
    const lent = current.loans.reduce((sum, loan) => sum + loan.count, 0);
    return pieces.length === 0 && numberOf(values, 'stock') < lent
      ? `Der Bestand ist kleiner als die verliehene Menge (${lent}).`
      : '';
  };

  protected readonly stockCheck = (values: FormValues): string => {
    const item = this.counting();
    const lent = item ? item.loans.reduce((sum, loan) => sum + loan.count, 0) : 0;
    return numberOf(values, 'stock') < lent
      ? `Der Bestand ist kleiner als die verliehene Menge (${lent}).`
      : '';
  };

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected subline(item: EquipmentItem): string {
    return [item.category, item.place, `verfügbar ${availableOf(item)}/${item.stock}`]
      .filter(Boolean)
      .join(' · ');
  }

  protected pieceLent(item: EquipmentItem, piece: string): boolean {
    return item.loans.some((loan) => loan.piece === piece);
  }

  protected anyOverdue(item: EquipmentItem): boolean {
    return item.loans.some((loan) => isOverdue(loan, this.store.today));
  }

  protected add(): void {
    this.editing.set(emptyItem());
  }

  protected save(values: FormValues): void {
    const current = this.editing();
    if (!current) return;
    const minimum = textOf(values, 'minimum');
    this.store.save({
      ...current,
      title: textOf(values, 'title'),
      category: textOf(values, 'category'),
      place: textOf(values, 'place'),
      stock: Math.max(0, Math.round(numberOf(values, 'stock'))),
      minimum: minimum === '' ? null : Math.max(0, Math.round(numberOf(values, 'minimum'))),
      unit: textOf(values, 'unit') || 'Stück',
      condition: conditionOf(textOf(values, 'condition')),
      toBuy: flagOf(values, 'toBuy'),
      pieces: listOf(values, 'pieces'),
      note: textOf(values, 'note'),
    });
    this.toasts.saved(current.id ? 'Gegenstand gespeichert' : 'Gegenstand angelegt');
    this.editing.set(null);
  }

  protected saveStock(values: FormValues): void {
    const item = this.counting();
    if (item) {
      this.store.setStock(item.id, Math.max(0, Math.round(numberOf(values, 'stock'))));
      this.toasts.saved('Bestand gespeichert');
    }
    this.counting.set(null);
  }

  protected giveBack(item: EquipmentItem, loan: Loan): void {
    this.store.giveBack(item.id, loan.id);
    this.toasts.saved('Rückgabe eingetragen');
  }

  protected confirmDelete(): void {
    const item = this.toDelete();
    if (item) {
      this.store.remove(item.id);
      this.toasts.saved('Gegenstand gelöscht');
    }
    this.toDelete.set(null);
  }

  protected exportExcel(): void {
    downloadXlsx('Materialliste.xlsx', itemsBook(this.visible(), this.store.today));
  }
}
