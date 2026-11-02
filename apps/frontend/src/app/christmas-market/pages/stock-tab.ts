import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { downloadXlsx } from '../../competition/competition-download';
import { euro, roundCents } from '../../core/money';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import {
  FieldDef,
  FieldOption,
  FormDialog,
  FormValues,
  numberOf,
  textOf,
} from '../../ui/form-dialog';
import { Toasts } from '../../ui/toast';
import { marketFileName, shoppingBook } from '../market.export';
import {
  Buy,
  STATUSES,
  StockItem,
  buyOf,
  numberText,
  onShoppingList,
  quantity,
} from '../market.models';
import { MarketStore } from '../market.store';

interface ShoppingRow {
  item: StockItem;
  buy: Buy;
}

interface ShopGroup {
  name: string;
  rows: ShoppingRow[];
  total: number;
}

interface CategoryGroup {
  name: string;
  items: StockItem[];
}

const NO_SHOP = 'Ohne Laden';

/** Whether an article is on the shopping list: by its category, or by a choice that was made. */
const LIST_OPTIONS: readonly FieldOption[] = [
  { value: 'auto', label: 'Automatisch, nach der Kategorie' },
  { value: 'yes', label: 'Ja, auf die Einkaufsliste' },
  { value: 'no', label: 'Nein, nicht auf die Einkaufsliste' },
];

function choiceOf(onList: boolean | null): string {
  if (onList === null) return 'auto';
  return onList ? 'yes' : 'no';
}

function onListOf(choice: string): boolean | null {
  if (choice === 'yes') return true;
  return choice === 'no' ? false : null;
}

function byName(a: StockItem, b: StockItem): number {
  return a.name.localeCompare(b.name, 'de');
}

/** The shopping list by store and the inventory by category, with what is missing and the cost. */
@Component({
  selector: 'app-market-stock',
  imports: [Action, ConfirmDialog, FormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stock-tab.html',
  styleUrl: './stock-tab.scss',
})
export class StockTab {
  protected readonly store = inject(MarketStore);
  private readonly toasts = inject(Toasts);

  protected readonly euro = euro;
  protected readonly statuses = STATUSES;
  protected readonly quantity = quantity;

  protected readonly view = signal<'list' | 'stock'>('list');
  protected readonly editing = signal<StockItem | null>(null);
  protected readonly toDelete = signal<StockItem | null>(null);

  protected readonly groups = computed<ShopGroup[]>(() => {
    const byShop = new Map<string, ShoppingRow[]>();
    for (const item of [...this.store.shopping()].sort(byName)) {
      const name = item.store || NO_SHOP;
      byShop.set(name, [...(byShop.get(name) ?? []), { item, buy: buyOf(item) }]);
    }
    return [...byShop]
      .sort(([a], [b]) => (a === NO_SHOP ? 1 : b === NO_SHOP ? -1 : a.localeCompare(b, 'de')))
      .map(([name, rows]) => ({
        name,
        rows,
        total: roundCents(rows.reduce((sum, row) => sum + row.buy.total, 0)),
      }));
  });

  protected readonly categoryGroups = computed<CategoryGroup[]>(() =>
    this.store
      .categories()
      .map((name) => ({
        name,
        items: this.store
          .stock()
          .filter((item) => item.category === name)
          .sort(byName),
      }))
      .filter((group) => group.items.length > 0),
  );

  protected readonly fields = computed<FieldDef[]>(() => [
    { key: 'name', label: 'Artikel', required: true },
    { key: 'category', label: 'Kategorie', suggestions: this.store.categories() },
    { key: 'box', label: 'Aufbewahrung', placeholder: 'zum Beispiel Box 3' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: STATUSES.map((value) => ({ value, label: value })),
    },
    { key: 'need', label: 'Bedarf', type: 'number' },
    { key: 'unit', label: 'Einheit', placeholder: 'kg, l, Stück ...' },
    { key: 'stock', label: 'Im Lager', type: 'number' },
    {
      key: 'pack',
      label: 'Größe einer Packung',
      type: 'number',
      hint: 'In der Einheit des Artikels. 0 heißt: wird einzeln gekauft.',
    },
    { key: 'price', label: 'Preis je Packung', type: 'number' },
    { key: 'store', label: 'Laden', suggestions: this.store.shops() },
    { key: 'onList', label: 'Einkaufsliste', type: 'select', options: LIST_OPTIONS },
  ]);

  protected readonly values = computed(() => {
    const item = this.editing();
    return item ? { ...item, onList: choiceOf(item.onList) } : {};
  });

  protected isOnList(item: StockItem): boolean {
    return onShoppingList(item);
  }

  protected missingText(row: ShoppingRow): string {
    if (row.buy.done) return 'gekauft';
    return row.buy.missing > 0 ? quantity(row.buy.missing, row.item.unit) : 'ok';
  }

  protected packText(row: ShoppingRow): string {
    const { item, buy } = row;
    if (buy.shownPacks <= 0) return '';
    return item.pack > 0
      ? `${numberText(buy.shownPacks)} × ${quantity(item.pack, item.unit)}`
      : quantity(buy.shownPacks, item.unit);
  }

  protected excel(): void {
    downloadXlsx(
      marketFileName('Einkaufsliste', this.store.year()),
      shoppingBook(this.store.stock()),
    );
  }

  protected setStock(item: StockItem, event: Event): void {
    const text = (event.target as HTMLInputElement).value.replace(',', '.');
    this.store.setStock(item.id, Number(text));
  }

  protected setStatus(item: StockItem, event: Event): void {
    this.store.setStatus(item.id, (event.target as HTMLSelectElement).value);
  }

  protected add(): void {
    this.editing.set(this.store.newItem());
  }

  protected save(values: FormValues): void {
    const item = this.editing();
    if (!item) return;
    const problem = this.store.saveItem({
      ...item,
      name: textOf(values, 'name'),
      category: textOf(values, 'category'),
      box: textOf(values, 'box'),
      status: textOf(values, 'status') || item.status,
      need: numberOf(values, 'need'),
      unit: textOf(values, 'unit'),
      stock: numberOf(values, 'stock'),
      pack: numberOf(values, 'pack'),
      price: numberOf(values, 'price'),
      store: textOf(values, 'store'),
      onList: onListOf(textOf(values, 'onList')),
    });
    if (problem) this.toasts.failed(problem);
    else {
      this.toasts.saved();
      this.editing.set(null);
    }
  }

  protected remove(): void {
    const item = this.toDelete();
    if (item) {
      this.store.removeItem(item.id);
      this.toasts.saved('Artikel gelöscht');
    }
    this.toDelete.set(null);
  }
}
