import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { euro } from '../../competition/competition.models';
import { fullDate } from '../../training/training-dates';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { FieldDef, FormDialog, FormValues, numberOf, textOf } from '../../ui/form-dialog';
import { Toasts } from '../../ui/toast';
import { EXPENSE_LABEL, Expense, ExpenseState, roundCents } from '../cash.models';
import { CashStore } from '../cash.store';

const FIELDS: readonly FieldDef[] = [
  { key: 'amount', label: 'Betrag (€)', type: 'number', required: true },
  { key: 'date', label: 'Datum', type: 'date', required: true },
  { key: 'text', label: 'Wofür?', required: true },
  { key: 'receipt', label: 'Beleg-Nr. / Notiz' },
];

/** Money that somebody paid in advance: requested, approved by the board, then refunded. */
@Component({
  selector: 'app-youth-expenses',
  imports: [Action, FormDialog, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expenses-tab.html',
})
export class ExpensesTab {
  protected readonly store = inject(CashStore);
  private readonly toasts = inject(Toasts);
  protected readonly euro = euro;
  protected readonly label = EXPENSE_LABEL;
  protected readonly fields = FIELDS;

  protected readonly adding = signal(false);
  protected readonly toDelete = signal<Expense | null>(null);
  protected readonly newExpense = computed(() => ({ date: this.store.today }));
  protected readonly list = computed(() =>
    [...this.store.expenses()].sort((a, b) => b.date.localeCompare(a.date)),
  );

  protected readonly check = (values: FormValues): string =>
    numberOf(values, 'amount') > 0 ? '' : 'Der Betrag muss größer als 0 sein.';

  protected subline(expense: Expense): string {
    return [
      fullDate(expense.date),
      expense.from && `von ${expense.from}`,
      expense.receipt && `Beleg ${expense.receipt}`,
      expense.handledBy && `bearbeitet von ${expense.handledBy}`,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  protected request(values: FormValues): void {
    const problem = this.store.requestExpense({
      amount: roundCents(numberOf(values, 'amount')),
      date: textOf(values, 'date'),
      text: textOf(values, 'text'),
      receipt: textOf(values, 'receipt'),
    });
    if (problem) {
      this.toasts.failed(problem);
      return;
    }
    this.toasts.saved('Auslage beantragt');
    this.adding.set(false);
  }

  protected setState(expense: Expense, state: ExpenseState): void {
    const problem = this.store.setExpenseState(expense.id, state);
    if (problem) {
      this.toasts.failed(problem);
      return;
    }
    this.toasts.saved(state === 'refunded' ? 'Erstattung als Ausgabe gebucht' : 'Gespeichert');
  }

  protected confirmDelete(): void {
    const expense = this.toDelete();
    if (expense) {
      this.store.removeExpense(expense.id);
      this.toasts.saved('Antrag gelöscht');
    }
    this.toDelete.set(null);
  }
}
