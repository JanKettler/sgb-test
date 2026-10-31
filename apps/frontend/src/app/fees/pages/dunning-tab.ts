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
import { downloadText } from '../../training/training-download';
import { fullDate } from '../../training/training-dates';
import { euro } from '../fees.models';
import { DunningRow, FeesStore } from '../fees.store';

@Component({
  selector: 'app-dunning-tab',
  imports: [Icon, SortButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dunning-tab.html',
  styles: `
    .is-shown td {
      background: var(--sgb-hover);
    }

    .mail-head {
      border-bottom: 1px solid var(--sgb-line);
      margin-bottom: 0.8rem;
      padding-bottom: 0.5rem;
    }

    .mail-subject {
      background: var(--sgb-card);
      border: 1px solid var(--sgb-line);
      border-radius: 8px;
      padding: 0.5rem 0.8rem;
    }

    .mail-preview {
      max-width: 44rem;
    }
  `,
})
export class DunningTab {
  protected readonly store = inject(FeesStore);
  readonly notice = output<string>();
  protected readonly euro = euro;
  protected readonly fullDate = fullDate;

  /** Ids the user switched off; everything is selected by default. */
  private readonly off = signal<ReadonlySet<string>>(new Set());
  protected readonly preview = signal('');

  protected readonly sort = new SortState('payer');
  protected readonly rows = computed(() => {
    const key = this.sort.key();
    const compare = (a: DunningRow, b: DunningRow): number => {
      if (key === 'amount') return a.payment.amount - b.payment.amount;
      if (key === 'total') return a.total - b.total;
      if (key === 'level') return a.level - b.level;
      if (key === 'since') return a.payment.dueDate.localeCompare(b.payment.dueDate);
      return a.payment.payerName.localeCompare(b.payment.payerName, 'de');
    };
    return [...this.store.dunningRows()].sort((a, b) => this.sort.apply(compare(a, b)));
  });
  protected readonly chosen = computed(() =>
    this.rows().filter((row) => !this.off().has(row.payment.id)),
  );
  protected readonly sums = computed(() => {
    const rows = this.chosen();
    const open = rows.reduce((sum, row) => sum + row.payment.amount, 0);
    const fees = rows.reduce((sum, row) => sum + row.fee, 0);
    return { open, fees, total: open + fees };
  });
  protected readonly shown = computed<DunningRow | undefined>(() => {
    const rows = this.chosen();
    return rows.find((row) => row.payment.id === this.preview()) ?? rows[0];
  });
  protected readonly mail = computed(() => {
    const row = this.shown();
    return row ? this.store.dunningMail(row) : undefined;
  });

  protected isOn(row: DunningRow): boolean {
    return !this.off().has(row.payment.id);
  }

  protected toggle(row: DunningRow): void {
    this.off.update((current) => {
      const next = new Set(current);
      if (!next.delete(row.payment.id)) next.add(row.payment.id);
      return next;
    });
  }

  protected send(): void {
    const sent = this.store.sendDunning(new Set(this.chosen().map((row) => row.payment.id)));
    this.off.set(new Set());
    this.notice.emit(`Demo: ${sent} Mahnungen vorbereitet, nichts wurde versendet.`);
  }

  exportCsv(): void {
    const lines = [
      ['Zahler', 'Person', 'Offen', 'Gebühr', 'Gesamt', 'Stufe'],
      ...this.chosen().map((row) => [
        row.payment.payerName,
        row.payment.label,
        euro(row.payment.amount),
        euro(row.fee),
        euro(row.total),
        String(row.level),
      ]),
    ];
    downloadText(
      'Mahnungen.csv',
      String.fromCharCode(0xfeff) + lines.map((line) => line.join(';')).join('\r\n'),
    );
  }
}
