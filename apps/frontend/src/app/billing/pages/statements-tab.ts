import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Action } from '../../ui/action';
import { FieldDef, FormDialog, FormValues, textOf } from '../../ui/form-dialog';
import { Toasts } from '../../ui/toast';
import { BillingStore } from '../billing.store';
import { StatementEditor } from './statement-editor';
import { StatementList } from './statement-list';

const PROFILE_FIELDS: readonly FieldDef[] = [
  { key: 'license', label: 'Lizenz', hint: 'Bestimmt den Stundensatz laut „Sätze“.' },
  { key: 'edv', label: 'ÜL-EDV-Nr.' },
  { key: 'accountHolder', label: 'Kontoinhaber (falls abweichend)' },
  { key: 'iban', label: 'IBAN' },
  { key: 'bic', label: 'BIC' },
];

/** The own statements of the logged-in person; a statement opens in the editor. */
@Component({
  selector: 'app-billing-statements',
  imports: [Action, FormDialog, StatementEditor, StatementList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './statements-tab.html',
})
export class StatementsTab {
  protected readonly store = inject(BillingStore);
  private readonly toasts = inject(Toasts);
  protected readonly fields = PROFILE_FIELDS;

  protected readonly openId = signal('');
  protected readonly profileOpen = signal(false);

  protected create(): void {
    this.openId.set(this.store.create().id);
  }

  protected saveProfile(values: FormValues): void {
    this.store.saveProfile(this.store.me(), {
      license: textOf(values, 'license'),
      edv: textOf(values, 'edv'),
      accountHolder: textOf(values, 'accountHolder'),
      iban: textOf(values, 'iban'),
      bic: textOf(values, 'bic'),
    });
    this.toasts.saved('Angaben gespeichert');
    this.profileOpen.set(false);
  }
}
