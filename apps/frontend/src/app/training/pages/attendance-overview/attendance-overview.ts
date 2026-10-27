import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Icon } from '../../../ui/icon';
import { ExportDialog } from '../../dialogs/export-dialog';
import { MailDialog } from '../../dialogs/mail-dialog';
import { addMonthKey, dayMonth, monthKey, monthLabel, weekdayShort } from '../../training-dates';
import { GroupId, TrainingSession } from '../../training.models';
import { ActionNeeded, TrainingStore } from '../../training.store';

type MailKind = 'info' | 'inactive';

interface MailRequest {
  kind: MailKind;
  entry: ActionNeeded;
}

@Component({
  selector: 'app-attendance-overview',
  imports: [Icon, MailDialog, ExportDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './attendance-overview.html',
  styleUrl: './attendance-overview.scss',
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
    () => this.action().inactive.length + this.action().info.length > 0,
  );

  protected groupOf(entry: ActionNeeded): string {
    return entry.person.groupId ? this.store.groupName(entry.person.groupId) : '';
  }

  protected reasonText(entry: ActionNeeded): string {
    return entry.registered
      ? `${entry.streak} Mal hintereinander angemeldet und nicht gekommen`
      : `${entry.streak} Mal ohne Rückmeldung nicht gekommen`;
  }

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

  protected mailTemplate(request: MailRequest): string {
    return request.kind === 'info' ? 'info' : 'inactive';
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
