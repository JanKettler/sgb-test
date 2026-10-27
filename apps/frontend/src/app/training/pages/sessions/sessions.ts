import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { GroupChips } from '../../../ui/group-chips';
import { DateField } from '../../../ui/date-field';
import { Icon } from '../../../ui/icon';
import { ModalDialog } from '../../../ui/modal-dialog';
import { MailDialog } from '../../dialogs/mail-dialog';
import { RegisteredDialog } from '../../dialogs/registered-dialog';
import { endTime, shortDay } from '../../training-dates';
import { GroupId, TrainingSession } from '../../training.models';
import { TrainingStore } from '../../training.store';

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

@Component({
  selector: 'app-sessions',
  imports: [RouterLink, Icon, DateField, GroupChips, ModalDialog, RegisteredDialog, MailDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sessions.html',
  styleUrl: './sessions.scss',
})
export class Sessions {
  protected readonly store = inject(TrainingStore);
  protected readonly shortDay = shortDay;

  /** Open range: an empty date means no limit on that side. */
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly group = signal<GroupId | ''>('');
  protected readonly trainer = signal('');
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  protected readonly toDelete = signal<TrainingSession | null>(null);
  protected readonly viewing = signal<TrainingSession | null>(null);
  protected readonly mailing = signal<TrainingSession | null>(null);
  protected readonly message = signal(this.takeFlash());

  protected readonly rows = computed<SessionRow[]>(() => {
    return this.store
      .sessions()
      .filter((session) => this.matches(session))
      .map((session): SessionRow => {
        const registered = this.store.registered(session);
        return {
          session,
          day: shortDay(session.date),
          time: `${session.time} – ${endTime(session.time, session.durationMinutes)}`,
          trainers: session.trainerIds.map((id) => this.store.personName(id)).join(', '),
          swimmers: registered.swimmers.length,
          trainerCount: registered.trainers.length,
          deadline: this.store.deadlineLabel(session),
          past: this.store.isPast(session),
          started: this.store.attendanceStarted(session),
        };
      });
  });

  /** Today's session, or the next one after it. */
  protected readonly nextId = computed(
    () => this.rows().find((row) => row.session.date >= this.store.today)?.session.id ?? '',
  );

  constructor() {
    afterNextRender(() => this.scrollToNext());
  }

  protected readonly filtered = computed(
    () => this.group() !== '' || this.trainer() !== '' || this.from() !== '' || this.to() !== '',
  );

  private takeFlash(): string {
    const text = this.store.flash();
    this.store.flash.set('');
    return text;
  }

  private matches(session: TrainingSession): boolean {
    if (this.from() && session.date < this.from()) return false;
    if (this.to() && session.date > this.to()) return false;
    const group = this.group();
    if (group && !session.groupIds.includes(group)) return false;
    const trainer = this.trainer();
    return !trainer || session.trainerIds.includes(trainer);
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected setGroup(event: Event): void {
    this.group.set(this.value(event) as GroupId | '');
  }

  protected resetFilters(): void {
    this.group.set('');
    this.trainer.set('');
    this.from.set('');
    this.to.set('');
  }

  /** Puts the next session directly below the sticky table heading. */
  protected scrollToNext(): void {
    const box = this.scroller()?.nativeElement;
    const row = box?.querySelector<HTMLElement>('tr.is-next');
    if (!box || !row) return;
    const head = box.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    const offset = row.getBoundingClientRect().top - box.getBoundingClientRect().top;
    box.scrollTop += offset - head;
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
