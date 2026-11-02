import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { downloadXlsx } from '../../competition/competition-download';
import { fullDate, weekdayIndex } from '../../training/training-dates';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { FieldDef, FormDialog, FormValues, numberOf, textOf } from '../../ui/form-dialog';
import { Icon } from '../../ui/icon';
import { Toasts } from '../../ui/toast';
import { helpersBook, marketFileName } from '../market.export';
import {
  DAY_NAME,
  DoughSpot,
  FIELD_NAME,
  MARKET_DAYS,
  MarketDay,
  SLOT_FIELDS,
  Slot,
  SlotField,
  countdownText,
  slotFull,
  slotMax,
} from '../market.models';
import { MarketStore, MyShift } from '../market.store';

/** Who is to be put on a line: asked for by the organisers, who sign up other people. */
type Ask = { kind: 'slot'; slot: Slot; field: SlotField } | { kind: 'dough'; spot: DoughSpot };

const NAME_FIELDS: readonly FieldDef[] = [
  { key: 'name', label: 'Name', required: true, placeholder: 'Vor- und Nachname' },
];

const SLOT_FORM: readonly FieldDef[] = [
  { key: 'label', label: 'Zeit', required: true, placeholder: '12:00–14:00' },
  { key: 'maxHelpers', label: 'Plätze für die Unterstützung (0 = ohne Grenze)', type: 'number' },
  { key: 'maxSupervisors', label: 'Plätze für die Aufsicht (0 = ohne Grenze)', type: 'number' },
  { key: 'note', label: 'Hinweis' },
];

const NOTICE_FORM: readonly FieldDef[] = [
  { key: 'text', label: 'Hinweis im Aushang', type: 'textarea', rows: 4 },
];

const DATE_FORM: readonly FieldDef[] = [
  { key: 'saturday', label: 'Samstag des Weihnachtsmarkts', type: 'date', required: true },
];

/** The notice board: countdown, helper lists, places for the waffle dough and my own shifts. */
@Component({
  selector: 'app-market-notice',
  imports: [Action, ConfirmDialog, FormDialog, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notice-tab.html',
})
export class NoticeTab {
  protected readonly store = inject(MarketStore);
  private readonly toasts = inject(Toasts);

  protected readonly days = MARKET_DAYS;
  protected readonly fields = SLOT_FIELDS;
  protected readonly dayName = DAY_NAME;
  protected readonly fieldName = FIELD_NAME;
  protected readonly nameFields = NAME_FIELDS;
  protected readonly slotForm = SLOT_FORM;
  protected readonly noticeForm = NOTICE_FORM;
  protected readonly dateForm = DATE_FORM;

  protected readonly asking = signal<Ask | null>(null);
  protected readonly editing = signal<Slot | null>(null);
  protected readonly toDelete = signal<Slot | null>(null);
  protected readonly editingNotice = signal(false);
  protected readonly editingDate = signal(false);

  protected readonly countdownLine = computed(() => countdownText(this.store.countdown()));
  protected readonly dates = computed(
    () => `${fullDate(this.store.dateOf('samstag'))} – ${fullDate(this.store.dateOf('sonntag'))}`,
  );
  protected readonly noticeValues = computed(() => ({ text: this.store.notice() }));
  protected readonly dateValues = computed(() => ({ saturday: this.store.saturday() }));

  protected readonly checkSaturday = (values: FormValues): string =>
    weekdayIndex(textOf(values, 'saturday')) === 6 ? '' : 'Das ist kein Samstag.';

  protected date(day: MarketDay): string {
    return fullDate(this.store.dateOf(day));
  }

  protected limit(slot: Slot, field: SlotField): number {
    return slotMax(slot, field);
  }

  protected full(slot: Slot, field: SlotField): boolean {
    return slotFull(slot, field);
  }

  protected askTitle(ask: Ask): string {
    return ask.kind === 'slot'
      ? `Eintragen: ${ask.slot.label}, ${FIELD_NAME[ask.field]}`
      : `Eintragen: Waffelteig, Platz ${ask.spot.no}`;
  }

  private report(problem: string, done: string): boolean {
    if (problem) this.toasts.failed(problem);
    else this.toasts.saved(done);
    return !problem;
  }

  /** The organisers type in who helps; everybody else signs up themselves. */
  protected sign(slot: Slot, field: SlotField): void {
    if (this.store.canOrganize()) this.asking.set({ kind: 'slot', slot, field });
    else this.report(this.store.signUp(slot.id, field), 'Du bist eingetragen');
  }

  protected claim(spot: DoughSpot): void {
    if (this.store.canOrganize()) this.asking.set({ kind: 'dough', spot });
    else this.report(this.store.claimDough(spot.id), 'Du bist eingetragen');
  }

  protected answer(values: FormValues): void {
    const ask = this.asking();
    if (!ask) return;
    const name = textOf(values, 'name');
    const problem =
      ask.kind === 'slot'
        ? this.store.signUp(ask.slot.id, ask.field, name)
        : this.store.claimDough(ask.spot.id, name);
    if (this.report(problem, 'Eingetragen')) this.asking.set(null);
  }

  protected signOff(slot: Slot, field: SlotField, index: number): void {
    this.store.signOff(slot.id, field, index);
    this.toasts.cancelled('Ausgetragen');
  }

  protected release(spot: DoughSpot): void {
    this.store.releaseDough(spot.id);
    this.toasts.cancelled('Ausgetragen');
  }

  protected removeShift(shift: MyShift): void {
    if (shift.field) this.store.signOff(shift.slotId, shift.field, shift.index);
    else this.store.releaseDough(shift.slotId);
    this.toasts.cancelled('Ausgetragen');
  }

  protected resize(day: MarketDay, delta: -1 | 1): void {
    const problem = this.store.resizeDough(day, delta);
    if (problem) this.toasts.failed(problem);
  }

  protected move(slot: Slot, delta: -1 | 1): void {
    this.store.moveSlot(slot.id, delta);
  }

  protected addSlot(day: MarketDay): void {
    this.editing.set(this.store.newSlot(day));
  }

  protected saveSlot(values: FormValues): void {
    const slot = this.editing();
    if (!slot) return;
    const limit = (key: string) => Math.max(0, Math.floor(numberOf(values, key)));
    const problem = this.store.saveSlot({
      ...slot,
      label: textOf(values, 'label'),
      maxHelpers: limit('maxHelpers'),
      maxSupervisors: limit('maxSupervisors'),
      note: textOf(values, 'note'),
    });
    if (this.report(problem, 'Gespeichert')) this.editing.set(null);
  }

  protected removeSlot(): void {
    const slot = this.toDelete();
    if (slot) {
      this.store.removeSlot(slot.id);
      this.toasts.saved('Zeile gelöscht');
    }
    this.toDelete.set(null);
  }

  protected saveNotice(values: FormValues): void {
    this.store.setNotice(textOf(values, 'text'));
    this.toasts.saved();
    this.editingNotice.set(false);
  }

  protected saveDate(values: FormValues): void {
    if (this.report(this.store.setSaturday(textOf(values, 'saturday')), 'Datum gespeichert')) {
      this.editingDate.set(false);
    }
  }

  protected excel(): void {
    downloadXlsx(
      marketFileName('Helferliste', this.store.year()),
      helpersBook(this.store.saturday(), this.store.slots(), this.store.dough()),
    );
  }
}
