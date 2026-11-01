import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { fullDate } from '../../../training/training-dates';
import { dateOf, euro } from '../../competition.models';
import { CompetitionStore } from '../../competition.store';

@Component({
  selector: 'app-competition-evaluation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './evaluation.html',
})
export class CompetitionEvaluation {
  private readonly store = inject(CompetitionStore);
  protected readonly fullDate = fullDate;
  protected readonly euro = euro;

  protected readonly years = computed(() =>
    [...new Set(this.store.competitions().map((item) => dateOf(item).slice(0, 4)))].sort(),
  );
  protected readonly year = signal(this.store.today.slice(0, 4));

  protected readonly rows = computed(() =>
    this.store
      .competitions()
      .filter((item) => dateOf(item).startsWith(this.year()))
      .sort((a, b) => dateOf(a).localeCompare(dateOf(b)))
      .map((competition) => {
        const counts = this.store.counts(competition);
        return {
          competition,
          date: dateOf(competition),
          ...counts,
          fee: this.store.totalFee(competition),
        };
      }),
  );

  protected readonly totals = computed(() => {
    const rows = this.rows();
    return {
      singles: rows.reduce((sum, row) => sum + row.singles, 0),
      relays: rows.reduce((sum, row) => sum + row.relays, 0),
      fee: rows.reduce((sum, row) => sum + row.fee, 0),
    };
  });

  protected pick(event: Event): void {
    this.year.set((event.target as HTMLSelectElement).value);
  }
}
