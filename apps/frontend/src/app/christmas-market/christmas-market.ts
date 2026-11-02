import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { fullDate } from '../training/training-dates';
import { TabDef, Tabs } from '../ui/tabs';
import { DAY_NAME } from './market.models';
import { MarketStore } from './market.store';
import { CashTab } from './pages/cash-tab';
import { NoticeTab } from './pages/notice-tab';
import { RecipeTab } from './pages/recipe-tab';
import { SettlementTab } from './pages/settlement-tab';
import { SetupTab } from './pages/setup-tab';
import { StockTab } from './pages/stock-tab';

/**
 * The Christmas market of the club: the helper lists for everybody, the cash desk, the accounts, the
 * stock and shopping list, the punch recipe and the plan for setting up and taking down for the
 * organisers.
 */
@Component({
  selector: 'app-christmas-market',
  imports: [Tabs, NoticeTab, CashTab, SettlementTab, StockTab, RecipeTab, SetupTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './christmas-market.html',
})
export class ChristmasMarket {
  protected readonly store = inject(MarketStore);
  private readonly chosen = signal('notice');

  protected readonly dates = computed(
    () =>
      `${DAY_NAME.samstag}, ${fullDate(this.store.dateOf('samstag'))} und ` +
      `${DAY_NAME.sonntag}, ${fullDate(this.store.dateOf('sonntag'))}`,
  );

  /** Everybody sees the helper lists; the rest is for the organisers. */
  protected readonly tabs = computed<TabDef[]>(() => {
    const tabs: TabDef[] = [{ id: 'notice', label: 'Aushang' }];
    if (this.store.canOrganize()) {
      tabs.push(
        { id: 'cash', label: 'Kasse' },
        { id: 'settlement', label: 'Abrechnung' },
        { id: 'stock', label: 'Bestand & Einkauf', count: this.store.totals().missing },
        { id: 'recipe', label: 'Rezept' },
        { id: 'setup', label: 'Aufbau & Abbau' },
      );
    }
    return tabs;
  });

  /** The chosen tab, or the helper lists when the role has no access to it. */
  protected readonly tab = computed(() =>
    this.tabs().some((entry) => entry.id === this.chosen()) ? this.chosen() : 'notice',
  );

  protected pick(id: string): void {
    this.chosen.set(id);
  }
}
