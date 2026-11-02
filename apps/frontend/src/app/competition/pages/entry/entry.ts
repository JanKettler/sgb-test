import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { PeopleStore } from '../../../people/people.store';
import { fullDate, monthShort, weekdayLong, weekdayShort } from '../../../training/training-dates';
import { Action } from '../../../ui/action';
import { Icon } from '../../../ui/icon';
import { Competition, NO_TIME, dateOf, eventLabel } from '../../competition.models';
import { CompetitionStore } from '../../competition.store';
import { EntryForm } from '../entry-form/entry-form';

type Status = 'registered' | 'declined' | 'open' | 'closed';

/** One registered start for the small overview on the card. */
interface Start {
  no: number;
  label: string;
  /** "00:30,45", or "ohne Zeit" when no entry time was given. */
  time: string;
}

interface Row {
  competition: Competition;
  date: string;
  day: number;
  month: string;
  weekday: string;
  starts: Start[];
  status: Status;
  /** Whether the person may still register or change the starts. */
  editable: boolean;
  deadlineWeekday: string;
  /** "noch 3 Tage", "heute", "morgen" */
  left: string;
  tone: 'danger' | 'warning' | 'info';
}

/** "1 Start" or "3 Starts". */
export function startsText(count: number): string {
  return count === 1 ? '1 Start' : `${count} Starts`;
}

@Component({
  selector: 'app-competition-entry',
  imports: [Action, Icon, EntryForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entry.html',
  styleUrl: './entry.scss',
})
export class CompetitionEntry {
  protected readonly store = inject(CompetitionStore);
  private readonly people = inject(PeopleStore);
  protected readonly fullDate = fullDate;
  protected readonly startsText = startsText;

  private readonly selectedId = signal('');
  protected readonly openId = signal('');

  /** The swimmer being registered: the user, or one of the children. */
  protected readonly person = computed(() => {
    const actors = this.store.actors();
    return actors.find((actor) => actor.id === this.selectedId()) ?? actors[0];
  });

  protected readonly rows = computed<Row[]>(() => {
    const person = this.person();
    if (!person) return [];
    this.store.entries();
    this.store.declines();
    return this.store.visibleFor(person.id).map((competition) => {
      const starts = this.store.entriesOf(competition.id, person.id).map((entry) => {
        const event = competition.events.find((item) => item.no === entry.eventNo);
        return {
          no: entry.eventNo,
          label: event ? eventLabel(event) : `Wettkampf ${entry.eventNo}`,
          time: entry.time && entry.time !== NO_TIME ? entry.time : 'ohne Zeit',
        };
      });
      const status: Status =
        starts.length > 0
          ? 'registered'
          : this.store.isDeclined(competition.id, person.id)
            ? 'declined'
            : this.store.canRegister(competition)
              ? 'open'
              : 'closed';
      const date = dateOf(competition);
      const days = this.store.daysTo(competition.internalDeadline);
      return {
        competition,
        date,
        day: Number(date.slice(8, 10)),
        month: monthShort(date),
        weekday: weekdayLong(date),
        starts,
        status,
        editable: this.store.canEditEntries(competition, person.id),
        deadlineWeekday: weekdayShort(competition.internalDeadline),
        left: days <= 0 ? 'heute' : days === 1 ? 'morgen' : `noch ${days} Tage`,
        tone: days <= 3 ? 'danger' : days <= 7 ? 'warning' : 'info',
      };
    });
  });

  /** One line over the cards: for how many meets and starts the person is registered. */
  protected readonly summary = computed(() => {
    const rows = this.rows();
    if (rows.length === 0) return '';
    const registered = rows.filter((row) => row.status === 'registered');
    const starts = registered.reduce((sum, row) => sum + row.starts.length, 0);
    const waiting = rows.filter((row) => row.status === 'open').length;
    const declined = rows.filter((row) => row.status === 'declined').length;
    const parts =
      registered.length > 0
        ? [
            `${registered.length} von ${rows.length} ${rows.length === 1 ? 'Wettkampf' : 'Wettkämpfen'} gemeldet, ${startsText(starts)}`,
          ]
        : ['Noch für keinen Wettkampf gemeldet'];
    if (waiting > 0) parts.push(`${waiting} ohne Rückmeldung`);
    if (declined > 0) parts.push(`${declined} abgesagt`);
    return parts.join(' · ');
  });

  constructor() {
    // Start again with the first person when the demo role changes.
    effect(() => {
      this.store.actors();
      this.selectedId.set('');
      this.openId.set('');
    });
  }

  protected nameOf(id: string): string {
    const member = this.people.member(id);
    return member ? `${member.firstName} ${member.lastName}` : id;
  }

  protected select(event: Event): void {
    this.selectedId.set((event.target as HTMLSelectElement).value);
    this.openId.set('');
  }

  protected toggle(id: string): void {
    this.openId.update((current) => (current === id ? '' : id));
  }
}
