import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FieldDef, FormDialog, FormValues, numberOf, textOf } from '../../ui/form-dialog';
import { Toasts } from '../../ui/toast';
import { EquipmentItem, Loan } from '../equipment.models';
import { EquipmentStore, LoanDraft } from '../equipment.store';

function draftOf(values: FormValues): LoanDraft {
  return {
    who: textOf(values, 'who'),
    count: numberOf(values, 'count'),
    piece: textOf(values, 'piece'),
    since: textOf(values, 'since'),
    until: textOf(values, 'until'),
    note: textOf(values, 'note'),
  };
}

/** Lends an item to a member, or changes a loan that is still out. */
@Component({
  selector: 'app-loan-dialog',
  imports: [FormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-form-dialog
      [heading]="loan() ? 'Verleih ändern' : 'Ausgeben / Verleihen'"
      [subtitle]="item().title"
      [fields]="fields()"
      [values]="values()"
      [saveLabel]="loan() ? 'Speichern' : 'Ausgeben'"
      [check]="check"
      (saved)="save($event)"
      (closed)="closed.emit()"
    />
  `,
})
export class LoanDialog {
  private readonly store = inject(EquipmentStore);
  private readonly toasts = inject(Toasts);
  readonly item = input.required<EquipmentItem>();
  /** The loan that is changed; empty when the item is lent anew. */
  readonly loan = input<Loan | null>(null);
  readonly closed = output();

  protected readonly fields = computed<FieldDef[]>(() => {
    const item = this.item();
    const own = this.loan()?.id;
    const free = item.pieces.filter(
      (piece) => !item.loans.some((entry) => entry.piece === piece && entry.id !== own),
    );
    const what: FieldDef =
      item.pieces.length > 0
        ? {
            key: 'piece',
            label: 'Welches Stück',
            type: 'select',
            options: free.map((piece) => ({ value: piece, label: piece })),
          }
        : { key: 'count', label: 'Anzahl', type: 'number', required: true };
    return [
      {
        key: 'who',
        label: 'Wer (Name oder Mitgliedsnummer)',
        required: true,
        suggestions: this.store.memberNames(),
      },
      what,
      { key: 'since', label: 'Ausgabedatum', type: 'date' },
      { key: 'until', label: 'Rückgabedatum (optional)', type: 'date' },
      { key: 'note', label: 'Notiz (optional)' },
    ];
  });

  protected readonly values = computed(() => {
    const loan = this.loan();
    return loan ?? { count: 1, since: this.store.today };
  });

  protected readonly check = (values: FormValues): string =>
    this.store.loanProblem(this.item(), draftOf(values), this.loan());

  protected save(values: FormValues): void {
    const loan = this.loan();
    const draft = draftOf(values);
    const done = loan
      ? this.store.changeLoan(this.item().id, loan.id, draft)
      : this.store.lend(this.item().id, draft);
    if (!done) {
      this.toasts.failed('Das Material konnte nicht ausgegeben werden');
      return;
    }
    this.toasts.saved(loan ? 'Verleih gespeichert' : 'Material ausgegeben');
    this.closed.emit();
  }
}
