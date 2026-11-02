import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { euro } from '../../core/money';
import { Action } from '../../ui/action';
import { FieldDef, FormDialog, FormValues, listOf, numberOf } from '../../ui/form-dialog';
import { Toasts } from '../../ui/toast';
import { licenseRateLines, parseLicenseRates } from '../billing.models';
import { BillingStore } from '../billing.store';

/** The rates that new statements and drives are filled in with; the board changes them. */
@Component({
  selector: 'app-billing-rates',
  imports: [Action, FormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rates-tab.html',
})
export class RatesTab {
  protected readonly store = inject(BillingStore);
  private readonly toasts = inject(Toasts);
  protected readonly euro = euro;
  protected readonly editing = signal(false);

  protected readonly fields = computed<FieldDef[]>(() => [
    { key: 'hourly', label: 'Standard-Stundensatz (€)', type: 'number' },
    { key: 'km', label: 'Kilometergeld (€ pro km)', type: 'number' },
    { key: 'driveFee', label: 'Fahrer-Pauschale (€)', type: 'number' },
    {
      key: 'drivers',
      label: 'Fahrerliste',
      type: 'tags',
      hint: 'Namen mit Komma trennen. Nur sie stehen bei „Fahrt eintragen“ zur Auswahl.',
    },
    {
      key: 'licenses',
      label: 'Satz nach Lizenz',
      type: 'lines',
      rows: 4,
      hint: 'Pro Zeile: Lizenz | Satz, z. B. „Trainer C | 12“.',
    },
  ]);

  protected readonly values = computed(() => {
    const rates = this.store.rates();
    return {
      hourly: rates.hourly,
      km: rates.km,
      driveFee: rates.driveFee,
      drivers: rates.drivers,
      licenses: licenseRateLines(rates.licenses),
    };
  });

  protected save(values: FormValues): void {
    this.store.saveRates({
      hourly: numberOf(values, 'hourly'),
      km: numberOf(values, 'km'),
      driveFee: numberOf(values, 'driveFee'),
      drivers: listOf(values, 'drivers'),
      licenses: parseLicenseRates(listOf(values, 'licenses')),
    });
    this.toasts.saved('Sätze gespeichert');
    this.editing.set(false);
  }
}
