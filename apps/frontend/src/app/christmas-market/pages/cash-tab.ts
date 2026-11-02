import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { euro } from '../../core/money';
import { dayMonth, fullDate } from '../../training/training-dates';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { FieldDef, FormDialog, FormValues, numberOf, textOf } from '../../ui/form-dialog';
import { Icon } from '../../ui/icon';
import { Toasts } from '../../ui/toast';
import { CountDialog, CountResult } from '../../youth/pages/count-dialog';
import {
  DAY_NAME,
  MARKET_DAYS,
  MarketDay,
  Product,
  TallyType,
  Verdict,
  sturzVerdict,
} from '../market.models';
import { MarketStore } from '../market.store';

const DONATION_FORM: readonly FieldDef[] = [
  { key: 'amount', label: 'Spenden des Tages in Euro', type: 'number', required: true },
];

const WITHDRAWAL_FORM: readonly FieldDef[] = [
  { key: 'amount', label: 'Betrag in Euro', type: 'number', required: true },
  {
    key: 'reason',
    label: 'Grund',
    required: true,
    placeholder: 'zum Beispiel Wechselgeld geholt',
  },
];

const VERDICT_CLASS: Readonly<Record<Verdict['tone'], string>> = {
  none: 'is-light',
  ok: 'is-success is-light',
  warn: 'is-warning is-light',
  bad: 'is-danger is-light',
};

/** The cash desk of the market: counting what is sold, the donations, the cash count, closing a day. */
@Component({
  selector: 'app-market-cash',
  imports: [Action, ConfirmDialog, CountDialog, FormDialog, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cash-tab.html',
  styleUrl: './cash-tab.scss',
})
export class CashTab {
  protected readonly store = inject(MarketStore);
  private readonly toasts = inject(Toasts);

  protected readonly days = MARKET_DAYS;
  protected readonly dayName = DAY_NAME;
  protected readonly euro = euro;
  protected readonly donationForm = DONATION_FORM;
  protected readonly withdrawalForm = WITHDRAWAL_FORM;
  protected readonly fullDate = fullDate;

  /** The second day as soon as it has begun, else the first. */
  protected readonly day = signal<MarketDay>(
    this.store.today >= this.store.dateOf('sonntag') ? 'sonntag' : 'samstag',
  );
  protected readonly counting = signal<'start' | 'evening' | null>(null);
  protected readonly editingDonation = signal(false);
  protected readonly withdrawing = signal(false);
  protected readonly closing = signal(false);
  protected readonly reopening = signal(false);

  protected readonly closed = computed(() => this.store.isClosed(this.day()));
  protected readonly closingInfo = computed(() => this.store.closings()[this.day()]);
  protected readonly money = computed(() => this.store.finance().days[this.day()]);
  protected readonly sturz = computed(() => this.store.sturzOf(this.day()));
  protected readonly result = computed(() => this.store.resultOf(this.day()));
  protected readonly verdict = computed(() => sturzVerdict(this.result(), euro));
  protected readonly verdictClass = computed(() => VERDICT_CLASS[this.verdict().tone]);
  protected readonly rows = computed(() =>
    this.store.products().map((product) => ({
      product,
      tally: this.store.tally(this.day(), product.id),
    })),
  );
  protected readonly donationValues = computed(() => ({
    amount: this.money().donation > 0 ? this.money().donation : '',
  }));

  /** Says what the last booking was, so that it can be taken back. */
  protected readonly lastText = computed(() => {
    const last = this.store.last();
    if (!last || last.day !== this.day()) return '';
    const product = this.store.products().find((item) => item.id === last.productId);
    const sign = last.delta > 0 ? '+' : '−';
    const kind = last.type === 'paid' ? 'bezahlt' : 'gratis';
    return `${product?.name ?? 'Produkt'} ${kind} ${sign}${Math.abs(last.delta)}`;
  });

  protected readonly closeText = computed(() =>
    this.result().done
      ? `Danach lässt sich für ${DAY_NAME[this.day()]} nichts mehr buchen.`
      : `Der Kassensturz am Abend fehlt noch. Danach lässt sich für ${DAY_NAME[this.day()]} nichts mehr buchen.`,
  );

  protected date(day: MarketDay): string {
    return dayMonth(this.store.dateOf(day));
  }

  protected plusClass(product: Product): string {
    return `button is-large is-${product.tone}`;
  }

  private fail(problem: string): boolean {
    if (problem) this.toasts.failed(problem);
    return !problem;
  }

  protected book(product: Product, type: TallyType, delta: number): void {
    this.fail(this.store.count(this.day(), product.id, type, delta));
  }

  protected undo(): void {
    this.fail(this.store.undo());
  }

  protected saveDonation(values: FormValues): void {
    if (this.fail(this.store.setDonation(this.day(), numberOf(values, 'amount')))) {
      this.toasts.saved('Spende gespeichert');
      this.editingDonation.set(false);
    }
  }

  protected saveCount(result: CountResult): void {
    const when = this.counting();
    if (!when) return;
    if (this.fail(this.store.saveCount(this.day(), when, result.pieces))) {
      this.toasts.saved(
        when === 'start' ? 'Anfangsbestand gespeichert' : 'Kassensturz gespeichert',
      );
      this.counting.set(null);
    }
  }

  protected addWithdrawal(values: FormValues): void {
    const problem = this.store.addWithdrawal(
      this.day(),
      numberOf(values, 'amount'),
      textOf(values, 'reason'),
    );
    if (this.fail(problem)) {
      this.toasts.saved('Entnahme gespeichert');
      this.withdrawing.set(false);
    }
  }

  protected removeWithdrawal(id: string): void {
    this.store.removeWithdrawal(this.day(), id);
    this.toasts.saved('Entnahme gelöscht');
  }

  protected closeDay(): void {
    if (this.fail(this.store.closeDay(this.day()))) {
      this.toasts.saved(`${DAY_NAME[this.day()]} abgeschlossen`);
    }
    this.closing.set(false);
  }

  protected reopenDay(): void {
    if (this.fail(this.store.reopenDay(this.day()))) {
      this.toasts.saved(`${DAY_NAME[this.day()]} ist wieder offen`);
    }
    this.reopening.set(false);
  }
}
