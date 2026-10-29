import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DateField } from '../../ui/date-field';
import { Payment, euro } from '../../fees/fees.models';
import { PayAccount, PayMethod } from '../people.models';
import { fullDate } from '../../training/training-dates';

type TextKey = 'holder' | 'iban' | 'bic' | 'bank' | 'mandateRef';

/** How a payer pays: method, bank account, SEPA mandate and the fees they pay. */
@Component({
  selector: 'app-pay-account',
  imports: [RouterLink, DateField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pay-account.html',
})
export class PayAccountForm {
  readonly account = input.required<PayAccount>();
  readonly payments = input<Payment[]>([]);
  readonly feeName = input<(id: string) => string>(() => '');
  readonly changed = output<PayAccount>();

  protected readonly euro = euro;
  protected readonly fullDate = fullDate;
  protected readonly methods: PayMethod[] = ['Lastschrift', 'Überweisung'];

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected setMethod(method: PayMethod): void {
    this.changed.emit({ ...this.account(), method });
  }

  protected setText(key: TextKey, event: Event): void {
    this.changed.emit({ ...this.account(), [key]: this.value(event) });
  }

  protected setDate(mandateOn: string): void {
    this.changed.emit({ ...this.account(), mandateOn });
  }

  protected setMandate(on: boolean): void {
    this.changed.emit({ ...this.account(), mandate: on });
  }
}
