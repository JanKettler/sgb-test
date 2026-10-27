import { Component, computed, inject, signal } from '@angular/core';
import { AttendanceExportDialog } from './attendance-export-dialog';
import { Icon } from './icon';
import { MailDialog } from './mail-dialog';
import { addMonthKey, dayMonth, monthKey, monthLabel, weekdayShort } from './training-dates';
import { GroupId, TrainingSession } from './training.models';
import { ActionNeeded, TrainingStore } from './training.store';

type MailKind = 'info' | 'inactive';

interface MailRequest {
  kind: MailKind;
  entry: ActionNeeded;
}

@Component({
  selector: 'app-attendance-overview',
  imports: [Icon, MailDialog, AttendanceExportDialog],
  templateUrl: './attendance-overview.html',
})
export class AttendanceOverview {
  protected readonly store = inject(TrainingStore);
  protected readonly monthLabel = monthLabel;

  protected readonly groupId = signal<GroupId>('WK');
  protected readonly from = signal(addMonthKey(monthKey(this.store.today), -1));
  protected readonly to = signal(monthKey(this.store.today));
  protected readonly exporting = signal(false);
  protected readonly mailRequest = signal<MailRequest | null>(null);
  protected readonly message = signal('');

  protected readonly matrix = computed(() =>
    this.store.matrix(this.groupId(), this.from(), this.to()),
  );
  protected readonly action = computed(() => this.store.actionNeeded());

  protected readonly hasAction = computed(
    () => this.action().inactive.length > 0 || this.action().info.length > 0,
  );

  protected columnDay(session: TrainingSession): string {
    return `${weekdayShort(session.date).toUpperCase()}, ${dayMonth(session.date)}`;
  }

  protected value(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected shift(months: number): void {
    this.from.set(addMonthKey(this.from(), months));
    this.to.set(addMonthKey(this.to(), months));
  }

  protected openMail(kind: MailKind, entry: ActionNeeded): void {
    this.mailRequest.set({ kind, entry });
  }

  protected mailText(request: MailRequest): string {
    const settings = this.store.automation();
    const template =
      request.kind === 'info' ? settings.infoMailTemplate : settings.inactiveMailTemplate;
    return template.replace('{Name}', request.entry.person.name.split(' ')[0]);
  }

  protected mailSent(request: MailRequest): void {
    const name = request.entry.person.name;
    if (request.kind === 'inactive') {
      this.store.markInactive(request.entry.person.id);
      this.message.set(`${name} wurde auf inaktiv gesetzt (Demo: keine Mail versendet).`);
    } else {
      this.store.markHandled(request.entry.person.id);
      this.message.set(`Info-Mail an ${name} vorbereitet (Demo: keine Mail versendet).`);
    }
    this.mailRequest.set(null);
  }
}
