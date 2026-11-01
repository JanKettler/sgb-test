import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { euro } from '../../competition/competition.models';
import {
  addMonthKey,
  fullDate,
  lastDayOfMonth,
  monthKey,
  monthLabel,
} from '../../training/training-dates';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { Toasts } from '../../ui/toast';
import { piecesText } from '../cash.models';
import { CashStore } from '../cash.store';
import { CountDialog, CountResult } from './count-dialog';

/** How many months the closing list goes back. */
const MONTHS = 12;

interface MonthRow {
  key: string;
  bookings: number;
  unconfirmed: number;
  /** The month is over; the current month cannot be closed yet. */
  past: boolean;
  /** The month is over and nothing is waiting for a confirmation. */
  closable: boolean;
}

/** Monthly closing of the youth cash and the cash counts. */
@Component({
  selector: 'app-youth-close',
  imports: [Action, ConfirmDialog, CountDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './close-tab.html',
})
export class CloseTab {
  protected readonly store = inject(CashStore);
  private readonly toasts = inject(Toasts);
  protected readonly euro = euro;
  protected readonly fullDate = fullDate;
  protected readonly monthLabel = monthLabel;
  protected readonly piecesText = piecesText;

  protected readonly counting = signal(false);
  protected readonly toClose = signal<string | null>(null);
  protected readonly toOpen = signal<string | null>(null);

  protected readonly months = computed<MonthRow[]>(() => {
    const current = monthKey(this.store.today);
    return Array.from({ length: MONTHS }, (_, back) => {
      const key = addMonthKey(current, -back);
      const entries = this.store.entriesOf(key);
      const unconfirmed = entries.filter((entry) => entry.status === 'open').length;
      const past = key < current;
      return {
        key,
        bookings: entries.length,
        unconfirmed,
        past,
        closable: past && unconfirmed === 0,
      };
    });
  });

  protected readonly counts = computed(() =>
    [...this.store.counts()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
  );
  protected readonly lastPieces = computed(() => this.store.lastCount()?.pieces ?? {});

  protected saveCount(result: CountResult): void {
    const count = this.store.saveCount(result);
    this.counting.set(false);
    if (count.difference === 0) this.toasts.saved('Kasse stimmt');
    else this.toasts.show(`Differenz: ${euro(count.difference)}`, 'bad');
  }

  protected confirmClose(): void {
    const month = this.toClose();
    if (month) {
      if (this.store.closeMonth(month)) this.toasts.saved(`${monthLabel(month)} abgeschlossen`);
      else this.toasts.failed('Erst alle Buchungen bestätigen');
    }
    this.toClose.set(null);
  }

  protected confirmOpen(): void {
    const month = this.toOpen();
    if (month) {
      this.store.reopenMonth(month);
      this.toasts.saved(`${monthLabel(month)} ist wieder offen`);
    }
    this.toOpen.set(null);
  }

  protected balanceAtEnd(month: string): number {
    return this.store.balanceUpTo(true, lastDayOfMonth(month));
  }
}
