import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { Icon } from '../../ui/icon';
import { FeeSettings, PLACEHOLDERS, euro, parseEuro } from '../fees.models';
import { FeesStore } from '../fees.store';

type TextKey =
  'copyTo' | 'purposeTemplate' | 'accountHolder' | 'bank' | 'iban' | 'bic' | 'creditorId';
type NumberKey = 'feeLevel1' | 'feeFromLevel2';
type DaysKey = 'daysLevel1' | 'daysFromLevel2';

@Component({
  selector: 'app-fee-settings-tab',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fee-settings-tab.html',
})
export class FeeSettingsTab {
  private readonly store = inject(FeesStore);
  readonly notice = output<string>();
  protected readonly placeholders = PLACEHOLDERS;
  protected readonly euro = euro;

  /** Working copy; it only reaches the store on "Speichern". */
  protected readonly draft = signal<FeeSettings>({ ...this.store.settings() });
  protected readonly preview = computed(() => {
    const sample = this.store.payments()[0];
    return sample ? this.store.fillTemplate(this.draft().purposeTemplate, sample) : '';
  });

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected text(key: TextKey, event: Event): void {
    const value = this.value(event);
    this.draft.update((settings) => ({ ...settings, [key]: value }));
  }

  protected money(key: NumberKey, event: Event): void {
    const value = parseEuro(this.value(event));
    this.draft.update((settings) => ({ ...settings, [key]: value }));
  }

  protected days(key: DaysKey, event: Event): void {
    const value = Math.max(0, Math.round(Number(this.value(event)) || 0));
    this.draft.update((settings) => ({ ...settings, [key]: value }));
  }

  protected flag(key: 'remindDebit' | 'remindTransfer'): void {
    this.draft.update((settings) => ({ ...settings, [key]: !settings[key] }));
  }

  protected insert(placeholder: string): void {
    this.draft.update((settings) => ({
      ...settings,
      purposeTemplate: `${settings.purposeTemplate} ${placeholder}`.trim(),
    }));
  }

  protected save(): void {
    this.store.settings.set({ ...this.draft() });
    this.notice.emit('Einstellungen wurden gespeichert.');
  }

  protected cancel(): void {
    this.draft.set({ ...this.store.settings() });
  }
}
