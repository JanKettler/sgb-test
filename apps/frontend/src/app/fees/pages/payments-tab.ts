import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { Icon } from '../../ui/icon';
import { SortButton, SortState } from '../../ui/sort';
import { TablePager, pageOf } from '../../ui/table-pager';
import { ModalDialog } from '../../ui/modal-dialog';
import { downloadText } from '../../training/training-download';
import { Payment, euro } from '../fees.models';
import { FeesStore } from '../fees.store';

type StatusFilter = 'open' | 'paid' | 'all';

@Component({
  selector: 'app-payments-tab',
  imports: [Icon, ModalDialog, SortButton, TablePager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payments-tab.html',
  styles: `
    .purpose {
      max-width: 22rem;
      min-width: 12rem;
    }
  `,
})
export class PaymentsTab {
  protected readonly store = inject(FeesStore);
  readonly notice = output<string>();
  protected readonly euro = euro;

  protected readonly method = signal('');
  protected readonly status = signal<StatusFilter>('open');
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly toDelete = signal(false);

  protected readonly sort = new SortState('person');
  protected readonly page = signal(0);
  protected readonly size = signal(25);
  protected readonly types = this.store.types;

  protected readonly rows = computed(() => {
    const key = this.sort.key();
    const compare = (a: Payment, b: Payment): number => {
      switch (key) {
        case 'payer':
          return a.payerName.localeCompare(b.payerName, 'de');
        case 'type':
          return this.store
            .feeName(a.feeTypeId)
            .localeCompare(this.store.feeName(b.feeTypeId), 'de');
        case 'amount':
          return a.amount - b.amount;
        case 'method':
          return a.method.localeCompare(b.method, 'de');
        case 'dunning':
          return a.dunning - b.dunning;
        default:
          return a.label.localeCompare(b.label, 'de');
      }
    };
    return this.store
      .payments()
      .filter((payment) => {
        if (this.method() && payment.method !== this.method()) return false;
        if (this.status() === 'open') return !payment.paid;
        if (this.status() === 'paid') return payment.paid;
        return true;
      })
      .sort((a, b) => this.sort.apply(compare(a, b)));
  });

  protected readonly pageRows = computed(() => pageOf(this.rows(), this.page(), this.size()));

  protected setType(payment: Payment, event: Event): void {
    this.store.setFeeType(payment.id, this.value(event));
    this.notice.emit(`${payment.label}: Beitragsart geändert`);
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected toggle(payment: Payment): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (!next.delete(payment.id)) next.add(payment.id);
      return next;
    });
  }

  protected toggleAll(on: boolean): void {
    this.selected.set(on ? new Set(this.rows().map((payment) => payment.id)) : new Set());
  }

  protected book(): void {
    const count = this.selected().size;
    this.store.book(this.selected());
    this.selected.set(new Set());
    this.notice.emit(`${count} Zahlungseingang gebucht.`);
  }

  protected dun(): void {
    const sent = this.store.sendDunning(this.selected());
    this.selected.set(new Set());
    this.notice.emit(`Demo: ${sent} Mahnung vorbereitet, nichts wurde versendet.`);
  }

  protected remove(): void {
    const count = this.selected().size;
    this.store.remove(this.selected());
    this.selected.set(new Set());
    this.toDelete.set(false);
    this.notice.emit(`${count} Zahlung gelöscht.`);
  }

  generate(): void {
    const { created, adjusted } = this.store.generate();
    this.notice.emit(
      created + adjusted === 0
        ? 'Alle Mitglieder haben schon eine Zahlung.'
        : `${created} neue Zahlung erzeugt, ${adjusted} bestehende angepasst.`,
    );
  }

  exportCsv(): void {
    downloadText('Zahlungen.csv', this.store.paymentsCsv(this.rows()));
  }

  exportSepa(): void {
    downloadText('Lastschrift-Demo.xml', this.store.sepaText(this.rows()));
  }
}
