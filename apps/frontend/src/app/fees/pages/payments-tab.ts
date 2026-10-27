import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { Icon } from '../../ui/icon';
import { ModalDialog } from '../../ui/modal-dialog';
import { downloadText } from '../../training/training-download';
import { Payment, euro } from '../fees.models';
import { FeesStore } from '../fees.store';

type StatusFilter = 'open' | 'paid' | 'all';

@Component({
  selector: 'app-payments-tab',
  imports: [Icon, ModalDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payments-tab.html',
})
export class PaymentsTab {
  protected readonly store = inject(FeesStore);
  readonly notice = output<string>();
  protected readonly euro = euro;

  protected readonly method = signal('');
  protected readonly status = signal<StatusFilter>('open');
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly toDelete = signal(false);

  protected readonly rows = computed(() =>
    this.store.payments().filter((payment) => {
      if (this.method() && payment.method !== this.method()) return false;
      if (this.status() === 'open') return !payment.paid;
      if (this.status() === 'paid') return payment.paid;
      return true;
    }),
  );

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

  protected generate(): void {
    const created = this.store.generate();
    this.notice.emit(
      created ? `${created} neue Zahlung erzeugt.` : 'Alle Mitglieder haben schon eine Zahlung.',
    );
  }

  protected exportCsv(): void {
    downloadText('Zahlungen.csv', this.store.paymentsCsv(this.rows()));
  }

  protected exportSepa(): void {
    downloadText('Lastschrift-Demo.xml', this.store.sepaText(this.rows()));
  }
}
