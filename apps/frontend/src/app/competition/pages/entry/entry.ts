import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { PeopleStore } from '../../../people/people.store';
import { fullDate, weekdayLong } from '../../../training/training-dates';
import { Icon } from '../../../ui/icon';
import { Competition, dateOf } from '../../competition.models';
import { CompetitionStore } from '../../competition.store';
import { EntryForm } from '../entry-form/entry-form';

type Status = 'registered' | 'declined' | 'open' | 'closed';

interface Row {
  competition: Competition;
  date: string;
  weekday: string;
  starts: number;
  status: Status;
}

@Component({
  selector: 'app-competition-entry',
  imports: [Icon, EntryForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entry.html',
  styleUrl: './entry.scss',
})
export class CompetitionEntry {
  protected readonly store = inject(CompetitionStore);
  private readonly people = inject(PeopleStore);
  protected readonly fullDate = fullDate;

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
      const starts = this.store.entriesOf(competition.id, person.id).length;
      const status: Status =
        starts > 0
          ? 'registered'
          : this.store.isDeclined(competition.id, person.id)
            ? 'declined'
            : this.store.canRegister(competition)
              ? 'open'
              : 'closed';
      const date = dateOf(competition);
      return { competition, date, weekday: weekdayLong(date), starts, status };
    });
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
