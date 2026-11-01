import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { downloadXlsx } from '../../competition/competition-download';
import { euro } from '../../competition/competition.models';
import { fullDate, monthKey, monthLabel, addMonthKey } from '../../training/training-dates';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { FieldDef, FormDialog, FormValues, listOf, numberOf, textOf } from '../../ui/form-dialog';
import { Toasts } from '../../ui/toast';
import { CashEntry, EntryKind, emptyEntry, roundCents } from '../cash.models';
import { CashStore } from '../cash.store';
import { cashBookBook } from '../youth.export';

const KIND_OPTIONS = [
  { value: 'in', label: 'Einnahme' },
  { value: 'out', label: 'Ausgabe' },
];

const SETTINGS_FIELDS: readonly FieldDef[] = [
  { key: 'opening', label: 'Anfangsbestand (€)', type: 'number' },
  { key: 'place', label: 'Wo ist die Kasse?' },
  { key: 'holder', label: 'Wer verwahrt sie?' },
  { key: 'since', label: 'Seit', type: 'date' },
  {
    key: 'categories',
    label: 'Kategorien',
    type: 'lines',
    rows: 6,
    hint: 'Pro Zeile eine Kategorie.',
  },
];

/** The bookings of the youth cash, month by month, with the balance and the confirmations. */
@Component({
  selector: 'app-youth-entries',
  imports: [Action, FormDialog, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entries-tab.html',
})
export class EntriesTab {
  protected readonly store = inject(CashStore);
  private readonly toasts = inject(Toasts);
  protected readonly euro = euro;
  protected readonly fullDate = fullDate;
  protected readonly monthLabel = monthLabel;
  protected readonly settingsFields = SETTINGS_FIELDS;

  protected readonly month = signal(monthKey(this.store.today));
  protected readonly editing = signal<CashEntry | null>(null);
  protected readonly toDelete = signal<CashEntry | null>(null);
  protected readonly settings = signal(false);

  protected readonly entries = computed(() => this.store.entriesOf(this.month()));
  protected readonly closed = computed(() => this.store.closingOf(this.month()) !== undefined);
  protected readonly income = computed(() => this.sumOf('in'));
  protected readonly expense = computed(() => this.sumOf('out'));

  protected readonly fields = computed<FieldDef[]>(() => {
    const category = this.editing()?.category ?? '';
    const categories = this.store.categories();
    const names =
      category && !categories.includes(category) ? [...categories, category] : categories;
    return [
      { key: 'kind', label: 'Art', type: 'select', options: KIND_OPTIONS },
      { key: 'amount', label: 'Betrag (€)', type: 'number', required: true },
      { key: 'date', label: 'Datum', type: 'date', required: true },
      {
        key: 'category',
        label: 'Kategorie',
        type: 'select',
        options: names.map((name) => ({ value: name, label: name })),
      },
      { key: 'text', label: 'Wofür?', required: true },
      { key: 'receipt', label: 'Beleg-Nr. / Notiz', placeholder: 'z. B. 2026-07' },
    ];
  });

  /** The amount has to be positive and the month must not be closed. */
  protected readonly check = (values: FormValues): string => {
    if (!(numberOf(values, 'amount') > 0)) return 'Der Betrag muss größer als 0 sein.';
    return this.store.isClosed(textOf(values, 'date')) ? 'Dieser Monat ist abgeschlossen.' : '';
  };

  protected shift(months: number): void {
    this.month.update((key) => addMonthKey(key, months));
  }

  protected isClosed(entry: CashEntry): boolean {
    return this.store.isClosed(entry.date);
  }

  /** Bookings of a closed month stay as they are; confirmed ones are changed by the board only. */
  protected editable(entry: CashEntry): boolean {
    return (
      this.store.canBook() &&
      !this.isClosed(entry) &&
      (entry.status !== 'confirmed' || this.store.canConfirm())
    );
  }

  protected titleOf(entry: CashEntry): string {
    return entry.text || (entry.kind === 'out' ? 'Ausgabe' : 'Einnahme');
  }

  protected subline(entry: CashEntry): string {
    return [
      fullDate(entry.date),
      entry.category,
      entry.receipt && `Beleg ${entry.receipt}`,
      entry.from && `von ${entry.from}`,
      entry.confirmedBy && `bestätigt von ${entry.confirmedBy}`,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  protected add(kind: EntryKind): void {
    const date =
      this.month() === monthKey(this.store.today) ? this.store.today : `${this.month()}-01`;
    this.editing.set(emptyEntry(kind, date, this.store.categories()[0] ?? ''));
  }

  protected save(values: FormValues): void {
    const current = this.editing();
    if (!current) return;
    const problem = this.store.saveEntry({
      ...current,
      kind: textOf(values, 'kind') === 'out' ? 'out' : 'in',
      amount: roundCents(numberOf(values, 'amount')),
      date: textOf(values, 'date'),
      category: textOf(values, 'category'),
      text: textOf(values, 'text'),
      receipt: textOf(values, 'receipt'),
    });
    if (problem) {
      this.toasts.failed(problem);
      return;
    }
    this.toasts.saved(current.id ? 'Buchung gespeichert' : 'Buchung angelegt');
    this.editing.set(null);
  }

  protected confirm(entry: CashEntry, confirmed: boolean): void {
    this.store.setEntryStatus(entry.id, confirmed ? 'confirmed' : 'open');
    this.toasts.saved(confirmed ? 'Buchung bestätigt' : 'Bestätigung zurückgenommen');
  }

  protected confirmDelete(): void {
    const entry = this.toDelete();
    if (entry) {
      this.store.removeEntry(entry.id);
      this.toasts.saved('Buchung gelöscht');
    }
    this.toDelete.set(null);
  }

  protected saveSettings(values: FormValues): void {
    const config = this.store.config();
    this.store.saveConfig({
      opening: numberOf(values, 'opening'),
      place: textOf(values, 'place'),
      holder: textOf(values, 'holder'),
      since: textOf(values, 'since') || config.since,
      categories: listOf(values, 'categories'),
    });
    this.toasts.saved('Einstellungen gespeichert');
    this.settings.set(false);
  }

  protected exportExcel(): void {
    const year = Number(this.month().slice(0, 4));
    const book = this.store.bookOf(year);
    downloadXlsx(
      `Jugendkasse_${year}.xlsx`,
      cashBookBook(year, book.start, book.rows, this.store.today),
    );
  }

  private sumOf(kind: EntryKind): number {
    return roundCents(
      this.entries()
        .filter((entry) => entry.kind === kind)
        .reduce((sum, entry) => sum + entry.amount, 0),
    );
  }
}
