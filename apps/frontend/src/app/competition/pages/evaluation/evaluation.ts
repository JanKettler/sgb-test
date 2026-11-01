import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { fullDate } from '../../../training/training-dates';
import { dateOf, euro, staffCount } from '../../competition.models';
import { CompetitionStore } from '../../competition.store';

@Component({
  selector: 'app-competition-evaluation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './evaluation.html',
})
export class CompetitionEvaluation {
  protected readonly store = inject(CompetitionStore);
  protected readonly fullDate = fullDate;
  protected readonly euro = euro;
  protected readonly staffCount = staffCount;

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

  /** Who served as judge or coach at how many meets of the year. */
  protected readonly staff = computed(() => {
    const tally = new Map<string, { judge: number; coach: number }>();
    for (const { competition } of this.rows()) {
      for (const id of Object.values(competition.officials).flat()) {
        const entry = tally.get(id) ?? { judge: 0, coach: 0 };
        tally.set(id, { ...entry, judge: entry.judge + 1 });
      }
      for (const id of Object.values(competition.coaches).flat()) {
        const entry = tally.get(id) ?? { judge: 0, coach: 0 };
        tally.set(id, { ...entry, coach: entry.coach + 1 });
      }
    }
    return [...tally]
      .map(([id, count]) => ({ id, name: this.store.nameOf(id), ...count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  });

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
