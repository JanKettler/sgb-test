import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { euro } from '../../core/money';
import { downloadXlsx } from '../../competition/competition-download';
import { fullDate } from '../../training/training-dates';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import {
  FieldDef,
  FieldOption,
  FormDialog,
  FormValues,
  flagOf,
  numberOf,
  textOf,
} from '../../ui/form-dialog';
import { Icon } from '../../ui/icon';
import { Toasts } from '../../ui/toast';
import { marketFileName, settlementBook } from '../market.export';
import {
  DAY_NAME,
  MARKET_DAYS,
  MarketExpense,
  PRODUCT_TONES,
  Product,
  ProductTone,
} from '../market.models';
import { MarketStore } from '../market.store';

const SETTINGS_FORM: readonly FieldDef[] = [
  { key: 'fee', label: 'Standgebühr in Euro', type: 'number', required: true },
  {
    key: 'batch',
    label: 'Waffeln pro Teig',
    type: 'number',
    required: true,
    hint: 'Damit wird gerechnet, wie viele Teige gebraucht werden.',
  },
];

const TONE_LABEL: Readonly<Record<ProductTone, string>> = {
  warning: 'Gelb',
  danger: 'Rot',
  success: 'Grün',
  info: 'Hellblau',
  link: 'Blau',
  primary: 'Türkis',
};

const TONE_OPTIONS: readonly FieldOption[] = PRODUCT_TONES.map((value) => ({
  value,
  label: TONE_LABEL[value],
}));

const PRODUCT_FORM: readonly FieldDef[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'unit', label: 'Einheit', placeholder: 'Stück' },
  { key: 'price', label: 'Preis in Euro', type: 'number', required: true },
  { key: 'tone', label: 'Farbe', type: 'select', options: TONE_OPTIONS },
];

const EXPENSE_FORM: readonly FieldDef[] = [
  { key: 'date', label: 'Datum', type: 'date' },
  { key: 'text', label: 'Verwendungszweck', required: true },
  { key: 'amount', label: 'Betrag in Euro', type: 'number', required: true },
  { key: 'receipt', label: 'Der Beleg liegt vor', type: 'checkbox' },
];

/** The accounts of the market: what came in per day, the expenses, the profit and its booking. */
@Component({
  selector: 'app-market-settlement',
  imports: [Action, ConfirmDialog, FormDialog, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settlement-tab.html',
})
export class SettlementTab {
  protected readonly store = inject(MarketStore);
  private readonly toasts = inject(Toasts);

  protected readonly days = MARKET_DAYS;
  protected readonly dayName = DAY_NAME;
  protected readonly euro = euro;
  protected readonly fullDate = fullDate;
  protected readonly settingsForm = SETTINGS_FORM;
  protected readonly productForm = PRODUCT_FORM;
  protected readonly expenseForm = EXPENSE_FORM;

  protected readonly settings = signal(false);
  protected readonly editingProduct = signal<Product | null>(null);
  protected readonly productToDelete = signal<Product | null>(null);
  protected readonly editingExpense = signal<MarketExpense | null>(null);
  protected readonly expenseToDelete = signal<MarketExpense | null>(null);
  protected readonly booking = signal(false);

  protected readonly finance = this.store.finance;
  protected readonly profitClass = computed(() => (this.finance().profit < 0 ? 'is-late' : ''));
  protected readonly settingsValues = computed(() => ({
    fee: this.store.fee(),
    batch: this.store.wafflesPerBatch(),
  }));
  protected readonly productValues = computed(() => {
    const product = this.editingProduct();
    return product ? { ...product } : {};
  });
  protected readonly expenseValues = computed(() => {
    const expense = this.editingExpense();
    return expense ? { ...expense, amount: expense.amount > 0 ? expense.amount : '' } : {};
  });
  protected readonly sortedExpenses = computed(() =>
    [...this.store.expenses()].sort((a, b) => a.date.localeCompare(b.date)),
  );
  protected readonly freeWaffles = computed(() =>
    MARKET_DAYS.reduce((sum, day) => sum + this.store.tally(day, 'waffel').free, 0),
  );
  protected readonly canBook = computed(
    () => this.store.canOrganize() && !this.store.booked() && this.finance().profit > 0,
  );

  private fail(problem: string): boolean {
    if (problem) this.toasts.failed(problem);
    return !problem;
  }

  protected excel(): void {
    downloadXlsx(
      marketFileName('Abrechnung', this.store.year()),
      settlementBook({
        saturday: this.store.saturday(),
        products: this.store.products(),
        counts: this.store.counts(),
        finance: this.finance(),
        expenses: this.store.expenses(),
        sturz: {
          samstag: this.store.resultOf('samstag'),
          sonntag: this.store.resultOf('sonntag'),
        },
      }),
    );
  }

  protected saveSettings(values: FormValues): void {
    if (this.fail(this.store.setFee(numberOf(values, 'fee')))) {
      this.store.setWafflesPerBatch(numberOf(values, 'batch'));
      this.toasts.saved();
      this.settings.set(false);
    }
  }

  protected addProduct(): void {
    this.editingProduct.set({
      id: '',
      name: '',
      unit: '',
      price: 0,
      tone: 'info',
      icon: 'utensils',
      builtin: false,
    });
  }

  protected saveProduct(values: FormValues): void {
    const product = this.editingProduct();
    if (!product) return;
    const tone = PRODUCT_TONES.find((item) => item === textOf(values, 'tone')) ?? product.tone;
    const problem = this.store.saveProduct({
      ...product,
      name: textOf(values, 'name'),
      unit: textOf(values, 'unit'),
      price: numberOf(values, 'price'),
      tone,
    });
    if (this.fail(problem)) {
      this.toasts.saved();
      this.editingProduct.set(null);
    }
  }

  protected removeProduct(): void {
    const product = this.productToDelete();
    if (product) {
      this.store.removeProduct(product.id);
      this.toasts.saved('Produkt gelöscht');
    }
    this.productToDelete.set(null);
  }

  protected addExpense(): void {
    this.editingExpense.set({
      id: '',
      date: this.store.today,
      text: '',
      amount: 0,
      receipt: false,
    });
  }

  protected saveExpense(values: FormValues): void {
    const expense = this.editingExpense();
    if (!expense) return;
    const problem = this.store.saveExpense({
      ...expense,
      date: textOf(values, 'date'),
      text: textOf(values, 'text'),
      amount: numberOf(values, 'amount'),
      receipt: flagOf(values, 'receipt'),
    });
    if (this.fail(problem)) {
      this.toasts.saved();
      this.editingExpense.set(null);
    }
  }

  protected removeExpense(): void {
    const expense = this.expenseToDelete();
    if (expense) {
      this.store.removeExpense(expense.id);
      this.toasts.saved('Ausgabe gelöscht');
    }
    this.expenseToDelete.set(null);
  }

  protected bookProfit(): void {
    if (this.fail(this.store.bookProfit())) {
      this.toasts.saved('Der Gewinn ist in der Jugendkasse gebucht');
    }
    this.booking.set(false);
  }
}
