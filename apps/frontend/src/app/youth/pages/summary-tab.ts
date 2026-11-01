import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { downloadXlsx } from '../../competition/competition-download';
import { euro } from '../../competition/competition.models';
import { fullDate } from '../../training/training-dates';
import { Action } from '../../ui/action';
import { roundCents } from '../cash.models';
import { badgeSummaryBook } from '../youth.export';
import { BADGE_STATE_LABEL } from '../youth.models';
import { YouthStore } from '../youth.store';

/** What the badges brought in during a year, checked against the bookings of the youth cash. */
@Component({
  selector: 'app-youth-summary',
  imports: [Action],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './summary-tab.html',
})
export class SummaryTab {
  protected readonly store = inject(YouthStore);
  protected readonly euro = euro;
  protected readonly fullDate = fullDate;
  protected readonly stateLabel = BADGE_STATE_LABEL;

  protected readonly rows = computed(() => this.store.summaryOf(this.store.year()));
  protected readonly total = computed(() =>
    roundCents(this.rows().reduce((sum, row) => sum + row.sum, 0)),
  );
  protected readonly booked = computed(() => this.store.bookedIn(this.store.year()));
  protected readonly difference = computed(() => roundCents(this.booked() - this.total()));
  protected readonly list = computed(() => this.store.paidIn(this.store.year()));

  protected shift(years: number): void {
    this.store.year.update((year) => year + years);
  }

  protected exportExcel(): void {
    downloadXlsx(
      `Abrechnung_Abzeichen_${this.store.year()}.xlsx`,
      badgeSummaryBook(this.rows(), this.store.year(), this.store.today),
    );
  }
}
