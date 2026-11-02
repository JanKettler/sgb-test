import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { downloadXlsx } from '../../competition/competition-download';
import { Action } from '../../ui/action';
import { Toasts } from '../../ui/toast';
import { fullDate } from '../../training/training-dates';
import { borrowersBook } from '../equipment.export';
import { EquipmentItem, Loan, isOverdue, loanText } from '../equipment.models';
import { EquipmentStore } from '../equipment.store';
import { LoanDialog } from './loan-dialog';

/** Who has what: every member with the club material that is lent to them. */
@Component({
  selector: 'app-equipment-loans',
  imports: [Action, LoanDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loans-tab.html',
})
export class LoansTab {
  protected readonly store = inject(EquipmentStore);
  private readonly toasts = inject(Toasts);
  protected readonly isOverdue = isOverdue;
  protected readonly loanText = loanText;
  protected readonly fullDate = fullDate;

  protected readonly query = signal('');
  protected readonly changing = signal<{ item: EquipmentItem; loan: Loan } | null>(null);

  protected readonly visible = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('de');
    return this.store
      .borrowers()
      .filter(
        (borrower) =>
          !query ||
          borrower.name.toLocaleLowerCase('de').includes(query) ||
          borrower.memberNo.includes(query),
      );
  });

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected giveBack(item: EquipmentItem, loan: Loan): void {
    this.store.giveBack(item.id, loan.id);
    this.toasts.saved('Rückgabe eingetragen');
  }

  protected exportExcel(): void {
    if (this.store.borrowers().length === 0 && this.store.memberMaterial().length === 0) {
      this.toasts.show('Im Moment ist nichts verliehen.', 'info');
      return;
    }
    downloadXlsx(
      'Ausgabe_Verleih.xlsx',
      borrowersBook(this.store.borrowers(), this.store.memberMaterial(), this.store.today),
    );
  }
}
