import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { euro } from '../../core/money';
import { fullDate } from '../../training/training-dates';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { FieldDef, FormDialog, FormValues, flagOf, textOf } from '../../ui/form-dialog';
import { Toasts } from '../../ui/toast';
import { DRIVE_LABEL, DRIVE_PERIODS, Drive, inPeriod, periodIndex } from '../billing.models';
import { downloadDrives, printDrives } from '../billing.files';
import { BillingStore, DriveCandidate } from '../billing.store';

/** One form holds this many drives; more are split over several Excel pages. */
const PAGE_SIZE = 23;

const DRIVE_FIELDS: readonly FieldDef[] = [
  { key: 'date', label: 'Datum', type: 'date', required: true },
  {
    key: 'note',
    label: 'Bemerkung (optional)',
    placeholder: 'z. B. Wettkampftraining Hallenbad Delfin',
  },
];

/** The own drives to the competition training, by period, with the form for the flat fees. */
@Component({
  selector: 'app-billing-drives',
  imports: [Action, FormDialog, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './drives-tab.html',
})
export class DrivesTab {
  protected readonly store = inject(BillingStore);
  private readonly toasts = inject(Toasts);
  protected readonly euro = euro;
  protected readonly fullDate = fullDate;
  protected readonly periods = DRIVE_PERIODS;
  protected readonly label = DRIVE_LABEL;
  protected readonly fields = DRIVE_FIELDS;

  protected readonly period = signal(periodIndex(this.store.today));
  protected readonly year = signal(Number(this.store.today.slice(0, 4)));
  protected readonly editing = signal<Drive | null>(null);
  protected readonly adding = signal(false);
  protected readonly toDelete = signal<Drive | null>(null);
  protected readonly candidates = signal<DriveCandidate[] | null>(null);
  protected readonly toSubmit = signal<Drive[] | null>(null);

  protected readonly list = computed(() =>
    this.store.myDrives().filter((drive) => inPeriod(drive.date, this.year(), this.period())),
  );
  protected readonly open = computed(() =>
    this.list()
      .filter((drive) => drive.state === 'open')
      .sort((a, b) => a.date.localeCompare(b.date)),
  );
  protected readonly openSum = computed(() =>
    this.open().reduce((sum, drive) => sum + drive.amount, 0),
  );
  /** Pages of the Excel form: one, unless more than a page of drives is open. */
  protected readonly pages = computed(() =>
    Array.from({ length: Math.max(1, Math.ceil(this.open().length / PAGE_SIZE)) }, (_, i) => i + 1),
  );

  /** The days of the training that can be taken over, as one checkbox each. */
  protected readonly pickFields = computed<FieldDef[]>(() =>
    (this.candidates() ?? []).map((day) => ({
      key: day.date,
      label: `${fullDate(day.date)} · ${day.note}`,
      type: 'checkbox',
    })),
  );
  protected readonly pickValues = computed(() =>
    Object.fromEntries((this.candidates() ?? []).map((day) => [day.date, true])),
  );

  protected newDrive(): Drive {
    return {
      id: '',
      owner: this.store.me(),
      date: this.store.today,
      note: '',
      amount: this.store.rates().driveFee,
      state: 'open',
      settledOn: '',
    };
  }

  protected save(values: FormValues): void {
    const current = this.editing();
    if (!current) return;
    const data = { date: textOf(values, 'date'), note: textOf(values, 'note') };
    const problem = current.id
      ? this.store.updateDrive(current.id, data)
      : this.store.addDrive({ ...data, owner: current.owner });
    if (problem) {
      this.toasts.failed(problem);
      return;
    }
    this.toasts.saved(current.id ? 'Fahrt gespeichert' : 'Fahrt eingetragen');
    this.editing.set(null);
  }

  protected confirmDelete(): void {
    const drive = this.toDelete();
    if (drive) {
      this.store.removeDrive(drive.id);
      this.toasts.saved('Fahrt gelöscht');
    }
    this.toDelete.set(null);
  }

  protected pickDays(): void {
    const days = this.store.candidateDrives(this.store.me(), this.year(), this.period());
    if (days.length === 0) {
      this.toasts.show('Keine neuen Trainingstage in diesem Zeitraum.', 'info');
      return;
    }
    this.candidates.set(days);
  }

  protected takeDays(values: FormValues): void {
    let added = 0;
    for (const day of this.candidates() ?? []) {
      if (flagOf(values, day.date) && !this.store.addDrive({ ...day, owner: this.store.me() })) {
        added++;
      }
    }
    this.candidates.set(null);
    this.toasts.saved(`${added} ${added === 1 ? 'Fahrt' : 'Fahrten'} eingetragen`);
  }

  protected pageLabel(page: number): string {
    return this.pages().length > 1 ? `Excel Seite ${page}` : 'Excel';
  }

  protected exportExcel(page: number): void {
    const open = this.open();
    const chunk =
      open.length > PAGE_SIZE ? open.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : open;
    downloadDrives(this.store.me(), chunk, this.store.profileOf(this.store.me()), page);
    this.toSubmit.set(chunk);
  }

  protected print(): void {
    printDrives(
      this.store.me(),
      this.open(),
      this.store.profileOf(this.store.me()),
      this.store.today,
    );
  }

  protected confirmSubmit(): void {
    const chunk = this.toSubmit();
    if (chunk) {
      this.store.setDriveState(
        chunk.map((drive) => drive.id),
        'submitted',
      );
      this.toasts.saved('Als eingereicht markiert');
    }
    this.toSubmit.set(null);
  }

  protected yearShift(years: number): void {
    this.year.update((year) => year + years);
  }

  protected periodWord(count: number): string {
    return count === 1 ? 'Fahrt' : 'Fahrten';
  }
}
