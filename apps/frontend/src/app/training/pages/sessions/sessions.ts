import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GroupChips } from '../../../ui/group-chips';
import { Icon } from '../../../ui/icon';
import { ModalDialog } from '../../../ui/modal-dialog';
import { MailDialog } from '../../dialogs/mail-dialog';
import { RegisteredDialog } from '../../dialogs/registered-dialog';
import { addDays, endTime, shortDay } from '../../training-dates';
import { GroupId, TrainingSession } from '../../training.models';
import { TrainingStore } from '../../training.store';

type Range = '7' | '30' | 'all' | 'past';

interface SessionRow {
  session: TrainingSession;
  day: string;
  time: string;
  trainers: string;
  swimmers: number;
  trainerCount: number;
  deadline: string;
  past: boolean;
  started: boolean;
}

const RANGES: readonly { id: Range; label: string }[] = [
  { id: '7', label: 'Nächste 7 Tage' },
  { id: '30', label: 'Nächste 30 Tage' },
  { id: 'all', label: 'Alle kommenden' },
  { id: 'past', label: 'Vergangene' },
];

@Component({
  selector: 'app-sessions',
  imports: [RouterLink, Icon, GroupChips, ModalDialog, RegisteredDialog, MailDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sessions.html',
  styleUrl: './sessions.scss',
})
export class Sessions {
  protected readonly store = inject(TrainingStore);
  protected readonly ranges = RANGES;
  protected readonly shortDay = shortDay;

  protected readonly range = signal<Range>('7');
  protected readonly group = signal<GroupId | ''>('');
  protected readonly trainer = signal('');
  protected readonly venue = signal('');
  protected readonly toDelete = signal<TrainingSession | null>(null);
  protected readonly viewing = signal<TrainingSession | null>(null);
  protected readonly mailing = signal<TrainingSession | null>(null);
  protected readonly message = signal(this.takeFlash());

  protected readonly rows = computed<SessionRow[]>(() => {
    const today = this.store.today;
    const last = this.range() === '7' ? addDays(today, 6) : addDays(today, 29);
    const rows = this.store
      .sessions()
      .filter((session) => this.matches(session, today, last))
      .map((session): SessionRow => {
        const registered = this.store.registered(session);
        return {
          session,
          day: shortDay(session.date),
          time: `${session.time} · ${session.durationMinutes} Min`,
          trainers: session.trainerIds.map((id) => this.store.personName(id)).join(', '),
          swimmers: registered.swimmers.length,
          trainerCount: registered.trainers.length,
          deadline: this.store.deadlineLabel(session),
          past: this.store.isPast(session),
          started: this.store.attendanceStarted(session),
        };
      });
    return this.range() === 'past' ? rows.reverse() : rows;
  });

  protected readonly filtered = computed(
    () => this.group() !== '' || this.trainer() !== '' || this.venue() !== '',
  );

  private takeFlash(): string {
    const text = this.store.flash();
    this.store.flash.set('');
    return text;
  }

  private matches(session: TrainingSession, today: string, last: string): boolean {
    const range = this.range();
    if (range === 'past' ? session.date >= today : session.date < today) return false;
    if ((range === '7' || range === '30') && session.date > last) return false;
    const group = this.group();
    if (group && !session.groupIds.includes(group)) return false;
    const trainer = this.trainer();
    if (trainer && !session.trainerIds.includes(trainer)) return false;
    const venue = this.venue();
    return !venue || session.venueId === venue;
  }

  protected value(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected setGroup(event: Event): void {
    this.group.set(this.value(event) as GroupId | '');
  }

  protected resetFilters(): void {
    this.group.set('');
    this.trainer.set('');
    this.venue.set('');
  }

  protected mailRecipients(session: TrainingSession): string[] {
    const { trainers, swimmers } = this.store.registered(session);
    return [...trainers, ...swimmers].map((person) => person.name);
  }

  protected confirmDelete(): void {
    const session = this.toDelete();
    if (!session) return;
    this.store.deleteSession(session.id);
    this.toDelete.set(null);
    this.message.set('Der Termin wurde gelöscht.');
  }

  protected deleteText(session: TrainingSession): string {
    const end = endTime(session.time, session.durationMinutes);
    return `${shortDay(session.date)}, ${session.time}–${end} (${this.store.groupNames(session)})`;
  }
}
