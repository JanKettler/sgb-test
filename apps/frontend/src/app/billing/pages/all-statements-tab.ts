import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { euro } from '../../core/money';
import { StatementState, sumsOf } from '../billing.models';
import { BillingStore } from '../billing.store';
import { StatementEditor } from './statement-editor';
import { StatementList } from './statement-list';

type Filter = StatementState | 'all';

interface FilterChip {
  id: Filter;
  label: string;
  count: number;
}

/** Everybody's statements for the board: what waits for payment, what is paid, the drafts. */
@Component({
  selector: 'app-billing-all-statements',
  imports: [StatementEditor, StatementList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './all-statements-tab.html',
})
export class AllStatementsTab {
  protected readonly store = inject(BillingStore);
  protected readonly euro = euro;

  protected readonly openId = signal('');
  protected readonly filter = signal<Filter>('submitted');

  protected readonly chips = computed<FilterChip[]>(() => {
    const all = this.store.everyone();
    const count = (state: StatementState) => all.filter((entry) => entry.state === state).length;
    return [
      { id: 'submitted', label: 'Eingereicht', count: count('submitted') },
      { id: 'paid', label: 'Bezahlt', count: count('paid') },
      { id: 'draft', label: 'Entwürfe', count: count('draft') },
      { id: 'all', label: 'Alle', count: all.length },
    ];
  });

  protected readonly visible = computed(() =>
    this.store
      .everyone()
      .filter((entry) => this.filter() === 'all' || entry.state === this.filter()),
  );
  protected readonly sum = computed(() =>
    this.visible().reduce((total, entry) => total + sumsOf(entry).total, 0),
  );
}
