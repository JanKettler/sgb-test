import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Tabs, TabDef } from '../ui/tabs';
import { CashStore } from './cash.store';
import { BadgesTab } from './pages/badges-tab';
import { CloseTab } from './pages/close-tab';
import { EntriesTab } from './pages/entries-tab';
import { ExpensesTab } from './pages/expenses-tab';
import { PricesTab } from './pages/prices-tab';
import { SummaryTab } from './pages/summary-tab';
import { YouthStore } from './youth.store';

/** Youth work: the swimming badges of the members and the youth cash. */
@Component({
  selector: 'app-youth',
  imports: [Tabs, BadgesTab, SummaryTab, PricesTab, EntriesTab, ExpensesTab, CloseTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './youth.html',
})
export class Youth {
  private readonly youth = inject(YouthStore);
  private readonly cash = inject(CashStore);
  protected readonly tab = signal('badges');
  protected readonly tabs = computed<TabDef[]>(() => [
    { id: 'badges', label: 'Abzeichen', count: this.youth.dueRecords().length },
    { id: 'summary', label: 'Abrechnung Abzeichen' },
    { id: 'prices', label: 'Preise & Anforderungen' },
    { id: 'entries', label: 'Jugendkasse', count: this.cash.openEntries().length },
    { id: 'expenses', label: 'Auslagen', count: this.cash.requestedExpenses().length },
    { id: 'close', label: 'Abschluss' },
  ]);
}
