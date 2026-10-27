import { Component, inject, input, output, signal } from '@angular/core';
import { ModalDialog } from './modal-dialog';
import { addMonthKey, monthKey, monthLabel } from './training-dates';
import { downloadText } from './training-download';
import { ExportContent, TrainingStore } from './training.store';
import { GroupId } from './training.models';

/** Pop-up for the Excel list: names as rows, sessions as columns. */
@Component({
  selector: 'app-attendance-export-dialog',
  imports: [ModalDialog],
  templateUrl: './attendance-export-dialog.html',
})
export class AttendanceExportDialog {
  protected readonly store = inject(TrainingStore);
  protected readonly monthLabel = monthLabel;

  readonly initialGroup = input.required<GroupId>();
  readonly closed = output<void>();

  private readonly thisMonth = monthKey(this.store.today);
  protected readonly groupId = signal<GroupId | null>(null);
  protected readonly content = signal<ExportContent>('filled');
  protected readonly from = signal(addMonthKey(this.thisMonth, -1));
  protected readonly to = signal(this.thisMonth);

  protected currentGroup(): GroupId {
    return this.groupId() ?? this.initialGroup();
  }

  protected value(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected setGroup(event: Event): void {
    this.groupId.set(this.value(event) as GroupId);
  }

  protected setRange(from: string, to: string): void {
    this.from.set(from);
    this.to.set(to);
  }

  protected thisMonthRange(): void {
    this.setRange(this.thisMonth, this.thisMonth);
  }

  protected lastThreeMonths(): void {
    this.setRange(addMonthKey(this.thisMonth, -2), this.thisMonth);
  }

  protected season(): void {
    const year = this.thisMonth.slice(0, 4);
    this.setRange(`${year}-01`, `${year}-12`);
  }

  protected download(): void {
    const csv = this.store.attendanceCsv(
      this.currentGroup(),
      this.content(),
      this.from(),
      this.to(),
    );
    downloadText(`Anwesenheit_${this.currentGroup()}_${this.from()}_${this.to()}.csv`, csv);
    this.closed.emit();
  }
}
