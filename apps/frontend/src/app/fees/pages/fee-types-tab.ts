import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { Action } from '../../ui/action';
import { downloadXlsx } from '../../competition/competition-download';
import { feeTypesBook } from '../fees.export';
import { FeeType } from '../fees.models';
import { FeesStore } from '../fees.store';
import { euro, parseEuro } from '../../core/money';

@Component({
  selector: 'app-fee-types-tab',
  imports: [Action],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fee-types-tab.html',
})
export class FeeTypesTab {
  protected readonly store = inject(FeesStore);
  readonly notice = output<string>();
  protected readonly euro = euro;

  protected readonly draft = signal<FeeType | null>(null);
  protected readonly invalid = signal(false);

  /** Payers of the type that is being edited. */
  protected readonly payers = computed(() => {
    const type = this.draft();
    return type ? this.store.payments().filter((payment) => payment.feeTypeId === type.id) : [];
  });

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected edit(type: FeeType): void {
    this.invalid.set(false);
    this.draft.set({ ...type });
  }

  add(): void {
    this.invalid.set(false);
    this.draft.set(this.store.newType());
  }

  protected setName(event: Event): void {
    this.draft.update((type) => (type ? { ...type, name: this.value(event) } : type));
  }

  protected setAmount(event: Event): void {
    const amount = parseEuro(this.value(event));
    this.draft.update((type) => (type ? { ...type, amount } : type));
  }

  protected save(): void {
    const type = this.draft();
    if (!type) return;
    if (!type.name.trim()) {
      this.invalid.set(true);
      return;
    }
    this.store.saveType(type);
    this.draft.set(null);
    this.notice.emit(`${type.name} wurde gespeichert.`);
  }

  exportExcel(): void {
    const lines = this.store.types().map((type) => ({
      name: type.name,
      rule: type.rule,
      amount: type.amount,
      payers: this.store.payerCount(type.id),
    }));
    downloadXlsx('Beitragsarten.xlsx', feeTypesBook(lines, this.store.today));
  }
}
