import { Injectable, computed, inject, signal } from '@angular/core';
import { StartStore } from '../start/start.store';
import { addMonthKey, lastDayOfMonth, monthKey } from '../training/training-dates';
import { TrainingStore } from '../training/training.store';
import {
  CashConfig,
  CashCount,
  CashEntry,
  DEFAULT_CATEGORIES,
  EntryStatus,
  Expense,
  ExpenseState,
  MonthClosing,
  roundCents,
  signedAmount,
} from './cash.models';

/** Data for a new booking; the store adds the id, the status and who booked it. */
export type NewEntry = Pick<
  CashEntry,
  'kind' | 'amount' | 'date' | 'category' | 'text' | 'receipt'
> &
  Partial<Pick<CashEntry, 'ref'>>;

/** One line of the cash book: the booking and the balance after it. */
export interface CashBookRow {
  date: string;
  text: string;
  receipt: string;
  /** Plus for income, minus for expenses. */
  amount: number;
  balance: number;
}

/** In-memory stand-in for the future cash API. All data is invented. */
@Injectable({ providedIn: 'root' })
export class CashStore {
  private readonly training = inject(TrainingStore);
  private readonly start = inject(StartStore);
  private counter = 100;
  readonly today = this.training.today;

  /** The youth workers book; the board confirms, closes months and changes the settings. */
  readonly canBook = this.training.canManage;
  readonly canConfirm = this.training.isAdmin;
  readonly canAdminister = this.training.isAdmin;

  readonly config = signal<CashConfig>(this.sampleConfig());
  readonly entries = signal<CashEntry[]>(this.sampleEntries());
  readonly expenses = signal<Expense[]>(this.sampleExpenses());
  readonly counts = signal<CashCount[]>([]);
  readonly closings = signal<MonthClosing[]>(this.sampleClosings());

  readonly categories = computed(() =>
    this.config().categories.length > 0 ? this.config().categories : [...DEFAULT_CATEGORIES],
  );
  readonly balance = computed(() => this.balanceUpTo(true));
  readonly balanceWithOpen = computed(() => this.balanceUpTo(false));
  readonly openEntries = computed(() => this.entries().filter((entry) => entry.status === 'open'));
  readonly requestedExpenses = computed(() =>
    this.expenses().filter((expense) => expense.state === 'requested'),
  );
  readonly lastCount = computed(
    () => [...this.counts()].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null,
  );

  /** The cash balance; with `upto` only the bookings up to that ISO date. */
  balanceUpTo(onlyConfirmed: boolean, upto = ''): number {
    let sum = this.config().opening;
    for (const entry of this.entries()) {
      if (onlyConfirmed && entry.status !== 'confirmed') continue;
      if (upto && entry.date > upto) continue;
      sum += signedAmount(entry);
    }
    return roundCents(sum);
  }

  /** The cash book of a year: the balance carried over and the confirmed bookings of the year. */
  bookOf(year: number): { start: number; rows: CashBookRow[] } {
    const first = String(year);
    const confirmed = this.entries()
      .filter((entry) => entry.status === 'confirmed')
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const start = roundCents(
      confirmed
        .filter((entry) => entry.date.slice(0, 4) < first)
        .reduce((sum, entry) => sum + signedAmount(entry), this.config().opening),
    );
    let balance = start;
    const rows = confirmed
      .filter((entry) => entry.date.slice(0, 4) === first)
      .map((entry) => {
        balance = roundCents(balance + signedAmount(entry));
        return {
          date: entry.date,
          text: entry.text,
          receipt: entry.receipt,
          amount: signedAmount(entry),
          balance,
        };
      });
    return { start, rows };
  }

  isClosed(date: string): boolean {
    const month = monthKey(date);
    return this.closings().some((closing) => closing.month === month);
  }

  closingOf(month: string): MonthClosing | undefined {
    return this.closings().find((closing) => closing.month === month);
  }

  entriesOf(month: string): CashEntry[] {
    return this.entries()
      .filter((entry) => monthKey(entry.date) === month)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  }

  /** Saves a booking; returns what is wrong, or an empty text when it was saved. */
  saveEntry(entry: CashEntry): string {
    const problem = this.entryProblem(entry);
    if (problem) return problem;
    const user = this.start.userName();
    if (!entry.id) {
      this.entries.update((list) => [
        ...list,
        { ...entry, id: `k-${++this.counter}`, status: 'open', from: user, confirmedBy: '' },
      ]);
      return '';
    }
    const old = this.entries().find((item) => item.id === entry.id);
    if (old && this.isClosed(old.date)) return 'Dieser Monat ist abgeschlossen.';
    this.entries.update((list) => list.map((item) => (item.id === entry.id ? entry : item)));
    return '';
  }

  /** Books an income or expense that comes from somewhere else, e.g. a paid badge. */
  book(data: NewEntry): string {
    return this.saveEntry({
      id: '',
      status: 'open',
      from: '',
      confirmedBy: '',
      ref: '',
      ...data,
    });
  }

  removeEntry(id: string): void {
    const entry = this.entries().find((item) => item.id === id);
    if (!entry || this.isClosed(entry.date)) return;
    this.entries.update((list) => list.filter((item) => item.id !== id));
  }

  setEntryStatus(id: string, status: EntryStatus): void {
    const entry = this.entries().find((item) => item.id === id);
    if (!entry || this.isClosed(entry.date)) return;
    const confirmedBy = status === 'confirmed' ? this.start.userName() : '';
    this.entries.update((list) =>
      list.map((item) => (item.id === id ? { ...item, status, confirmedBy } : item)),
    );
  }

  requestExpense(data: Pick<Expense, 'amount' | 'date' | 'text' | 'receipt'>): string {
    if (!(data.amount > 0)) return 'Der Betrag muss größer als 0 sein.';
    this.expenses.update((list) => [
      ...list,
      {
        ...data,
        id: `l-${++this.counter}`,
        from: this.start.userName(),
        state: 'requested',
        handledBy: '',
      },
    ]);
    return '';
  }

  removeExpense(id: string): void {
    this.expenses.update((list) => list.filter((item) => item.id !== id));
  }

  /** Approves, rejects or refunds a request; a refund is booked as an expense of the cash. */
  setExpenseState(id: string, state: ExpenseState): string {
    const expense = this.expenses().find((item) => item.id === id);
    if (!expense) return '';
    if (state === 'refunded') {
      const problem = this.saveEntry({
        id: '',
        kind: 'out',
        amount: expense.amount,
        date: this.today,
        category: this.categories().at(-1) ?? '',
        text: `Erstattung: ${expense.text} (${expense.from})`,
        receipt: expense.receipt,
        status: 'open',
        from: '',
        confirmedBy: '',
        ref: id,
      });
      if (problem) return problem;
      const booked = this.entries().find((entry) => entry.ref === id);
      if (booked) this.setEntryStatus(booked.id, 'confirmed');
    }
    const handledBy = this.start.userName();
    this.expenses.update((list) =>
      list.map((item) => (item.id === id ? { ...item, state, handledBy } : item)),
    );
    return '';
  }

  /** Writes down a cash count with the balance of the book at that moment as the target. */
  saveCount(data: Pick<CashCount, 'date' | 'counted' | 'pieces' | 'note'>): CashCount {
    const expected = this.balance();
    const count: CashCount = {
      ...data,
      id: `z-${++this.counter}`,
      counted: roundCents(data.counted),
      expected,
      difference: roundCents(data.counted - expected),
      by: this.start.userName(),
    };
    this.counts.update((list) => [...list, count]);
    return count;
  }

  /** Locks a month; all its bookings have to be confirmed first. */
  closeMonth(month: string): boolean {
    if (this.closingOf(month) || this.entriesOf(month).some((entry) => entry.status === 'open')) {
      return false;
    }
    this.closings.update((list) => [
      ...list,
      {
        month,
        balance: this.balanceUpTo(true, lastDayOfMonth(month)),
        by: this.start.userName(),
        at: this.today,
      },
    ]);
    return true;
  }

  reopenMonth(month: string): void {
    this.closings.update((list) => list.filter((closing) => closing.month !== month));
  }

  saveConfig(config: CashConfig): void {
    this.config.set(config);
  }

  private entryProblem(entry: CashEntry): string {
    if (!(entry.amount > 0)) return 'Der Betrag muss größer als 0 sein.';
    if (this.isClosed(entry.date)) return 'Dieser Monat ist abgeschlossen.';
    return '';
  }

  private sampleConfig(): CashConfig {
    return {
      opening: 120,
      place: 'Vereinsheim, Schrank 3',
      holder: 'Anna Brandt',
      since: `${this.today.slice(0, 4)}-01-01`,
      categories: [...DEFAULT_CATEGORIES],
    };
  }

  private sampleEntries(): CashEntry[] {
    const lastMonth = addMonthKey(monthKey(this.today), -1);
    const base = { receipt: '', from: 'Anna', ref: '' };
    return [
      {
        ...base,
        id: 'k-1',
        kind: 'in',
        amount: 60,
        date: `${lastMonth}-05`,
        category: 'Veranstaltung',
        text: 'Kuchenverkauf Vereinsfest',
        status: 'confirmed',
        confirmedBy: 'Maria',
      },
      {
        ...base,
        id: 'k-2',
        kind: 'out',
        amount: 24.5,
        date: `${lastMonth}-12`,
        category: 'Material',
        text: 'Kreide und Stifte',
        receipt: '2026-14',
        status: 'confirmed',
        confirmedBy: 'Maria',
      },
      {
        ...base,
        id: 'k-3',
        kind: 'in',
        amount: 3,
        date: this.today,
        category: 'Abzeichen',
        text: 'Abzeichen DLA Hai: Mira Köhler (bar)',
        status: 'open',
        confirmedBy: '',
        ref: 'abz:r-3',
      },
      {
        ...base,
        id: 'k-4',
        kind: 'out',
        amount: 18.9,
        date: this.today,
        category: 'Verpflegung',
        text: 'Getränke Jugendtraining',
        status: 'open',
        confirmedBy: '',
      },
    ];
  }

  private sampleExpenses(): Expense[] {
    return [
      {
        id: 'l-1',
        amount: 12.4,
        date: this.today,
        text: 'Pokale für den Vereinsvergleich',
        receipt: '',
        from: 'Jonas',
        state: 'requested',
        handledBy: '',
      },
    ];
  }

  private sampleClosings(): MonthClosing[] {
    return [
      {
        month: addMonthKey(monthKey(this.today), -2),
        balance: 120,
        by: 'Maria',
        at: `${addMonthKey(monthKey(this.today), -1)}-02`,
      },
    ];
  }
}
