import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FeesStore } from '../fees.store';
import { DunningTab } from './dunning-tab';
import { FeeSettingsTab } from './fee-settings-tab';
import { FeeTypesTab } from './fee-types-tab';
import { PaymentsTab } from './payments-tab';

type Tab = 'payments' | 'dunning' | 'types' | 'settings';

@Component({
  selector: 'app-fees',
  imports: [PaymentsTab, DunningTab, FeeTypesTab, FeeSettingsTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fees.html',
})
export class Fees {
  protected readonly store = inject(FeesStore);
  protected readonly tab = signal<Tab>('payments');
  protected readonly message = signal('');

  protected readonly tabs = computed(() => [
    { id: 'payments' as const, label: 'Zahlungen', count: 0 },
    { id: 'dunning' as const, label: 'Mahnungen', count: this.store.dunningRows().length },
    { id: 'types' as const, label: 'Beitragsarten', count: 0 },
    { id: 'settings' as const, label: 'Einstellungen', count: 0 },
  ]);
}
