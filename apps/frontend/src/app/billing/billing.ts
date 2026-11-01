import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TabDef, Tabs } from '../ui/tabs';
import { BillingStore } from './billing.store';
import { AllDrivesTab } from './pages/all-drives-tab';
import { AllStatementsTab } from './pages/all-statements-tab';
import { DrivesTab } from './pages/drives-tab';
import { RatesTab } from './pages/rates-tab';
import { StatementsTab } from './pages/statements-tab';

/** Billing of the trainers: hours, drives to the competition training and the rates. */
@Component({
  selector: 'app-billing',
  imports: [Tabs, StatementsTab, DrivesTab, AllStatementsTab, AllDrivesTab, RatesTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './billing.html',
})
export class Billing {
  private readonly store = inject(BillingStore);
  protected readonly tab = signal('statements');

  /** The board also sees what everybody billed; the others only their own. */
  protected readonly tabs = computed<TabDef[]>(() => {
    const tabs: TabDef[] = [
      { id: 'statements', label: 'Stunden', count: this.store.draftCount() },
      { id: 'drives', label: 'Fahrten', count: this.store.openDriveCount() },
    ];
    if (this.store.isAdmin()) {
      tabs.push(
        { id: 'all-statements', label: 'Alle Stunden', count: this.store.submittedCount() },
        { id: 'all-drives', label: 'Alle Fahrten', count: this.store.allOpenDriveCount() },
      );
    }
    tabs.push({ id: 'rates', label: 'Sätze' });
    return tabs;
  });
}
