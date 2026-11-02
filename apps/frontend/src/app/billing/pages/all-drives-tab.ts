import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { euro } from '../../core/money';
import { fullDate } from '../../training/training-dates';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { FieldDef, FormDialog, FormValues, textOf } from '../../ui/form-dialog';
import { Toasts } from '../../ui/toast';
import { DRIVE_LABEL, Drive } from '../billing.models';
import { downloadDrives, printDrives } from '../billing.files';
import { BillingStore } from '../billing.store';

interface PersonDrives {
  owner: string;
  drives: Drive[];
  open: Drive[];
  sum: number;
}

/** The drives of everybody for the board: per person what is open, with the form and settling. */
@Component({
  selector: 'app-billing-all-drives',
  imports: [Action, FormDialog, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './all-drives-tab.html',
})
export class AllDrivesTab {
  protected readonly store = inject(BillingStore);
  private readonly toasts = inject(Toasts);
  protected readonly euro = euro;
  protected readonly fullDate = fullDate;
  protected readonly label = DRIVE_LABEL;

  protected readonly opened = signal<ReadonlySet<string>>(new Set());
  protected readonly adding = signal(false);
  protected readonly toSettle = signal<PersonDrives | null>(null);
  protected readonly toDelete = signal<Drive | null>(null);

  protected readonly groups = computed<PersonDrives[]>(() => {
    const byOwner = new Map<string, Drive[]>();
    for (const drive of this.store.drives()) {
      byOwner.set(drive.owner, [...(byOwner.get(drive.owner) ?? []), drive]);
    }
    return [...byOwner.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'de'))
      .map(([owner, list]) => {
        const drives = list.sort((a, b) => b.date.localeCompare(a.date));
        const open = drives.filter((drive) => drive.state === 'open');
        return { owner, drives, open, sum: open.reduce((total, drive) => total + drive.amount, 0) };
      });
  });

  protected readonly fields = computed<FieldDef[]>(() => [
    {
      key: 'owner',
      label: 'Fahrer/in',
      type: 'select',
      required: true,
      options: this.store.driverNames().map((name) => ({ value: name, label: name })),
    },
    { key: 'date', label: 'Datum', type: 'date', required: true },
    {
      key: 'note',
      label: 'Bemerkung (optional)',
      placeholder: 'z. B. Wettkampftraining Hallenbad Delfin',
    },
  ]);

  protected readonly newValues = computed(() => ({
    owner: this.store.driverNames()[0] ?? '',
    date: this.store.today,
    note: '',
  }));

  protected isOpen(owner: string): boolean {
    return this.opened().has(owner);
  }

  protected toggle(owner: string): void {
    this.opened.update((set) => {
      const next = new Set(set);
      if (!next.delete(owner)) next.add(owner);
      return next;
    });
  }

  protected add(values: FormValues): void {
    const problem = this.store.addDrive({
      owner: textOf(values, 'owner'),
      date: textOf(values, 'date'),
      note: textOf(values, 'note'),
    });
    if (problem) {
      this.toasts.failed(problem);
      return;
    }
    this.toasts.saved('Fahrt eingetragen');
    this.adding.set(false);
  }

  protected excel(group: PersonDrives): void {
    downloadDrives(group.owner, group.open, this.store.profileOf(group.owner));
  }

  protected print(group: PersonDrives): void {
    printDrives(group.owner, group.open, this.store.profileOf(group.owner), this.store.today);
  }

  protected confirmSettle(): void {
    const group = this.toSettle();
    if (group) {
      this.store.setDriveState(
        group.open.map((drive) => drive.id),
        'settled',
      );
      this.toasts.saved('Als abgerechnet markiert');
    }
    this.toSettle.set(null);
  }

  protected confirmDelete(): void {
    const drive = this.toDelete();
    if (drive) {
      this.store.removeDrive(drive.id);
      this.toasts.saved('Fahrt gelöscht');
    }
    this.toDelete.set(null);
  }

  protected word(count: number): string {
    return count === 1 ? 'Fahrt' : 'Fahrten';
  }
}
