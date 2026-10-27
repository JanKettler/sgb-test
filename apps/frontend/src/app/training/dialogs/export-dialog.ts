import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { DateField } from '../../ui/date-field';
import { ModalDialog } from '../../ui/modal-dialog';
import { addDays, addMonths, lastDayOfMonth, monthKey } from '../training-dates';
import { downloadText } from '../training-download';
import { GroupId } from '../training.models';
import { ExportContent, TrainingStore } from '../training.store';

/** Pop-up for the Excel list: names as rows, sessions as columns. */
@Component({
  selector: 'app-export-dialog',
  imports: [ModalDialog, DateField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './export-dialog.html',
})
export class ExportDialog {
  protected readonly store = inject(TrainingStore);
  private readonly thisMonth = monthKey(this.store.today);

  readonly initialGroup = input.required<GroupId>();
  readonly closed = output();

  protected readonly groupId = signal<GroupId | null>(null);
  protected readonly content = signal<ExportContent>('filled');
  protected readonly from = signal(addDays(this.store.today, -28));
  protected readonly to = signal(this.store.today);

  protected currentGroup(): GroupId {
    return this.groupId() ?? this.initialGroup();
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected setGroup(event: Event): void {
    this.groupId.set(this.value(event) as GroupId);
  }

  protected setContent(event: Event): void {
    this.content.set(this.value(event) as ExportContent);
  }

  protected setRange(from: string, to: string): void {
    this.from.set(from);
    this.to.set(to);
  }

  protected thisMonthRange(): void {
    this.setRange(`${this.thisMonth}-01`, lastDayOfMonth(this.thisMonth));
  }

  protected lastThreeMonths(): void {
    this.setRange(addMonths(`${this.thisMonth}-01`, -2), lastDayOfMonth(this.thisMonth));
  }

  protected season(): void {
    const year = this.thisMonth.slice(0, 4);
    this.setRange(`${year}-01-01`, `${year}-12-31`);
  }

  protected download(): void {
    const group = this.currentGroup();
    const csv = this.store.attendanceCsv(group, this.content(), this.from(), this.to());
    downloadText(`Anwesenheit_${group}_${this.from()}_${this.to()}.csv`, csv);
    this.closed.emit();
  }
}
