import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { PeopleStore } from '../../../people/people.store';
import { Icon } from '../../../ui/icon';
import { Toasts } from '../../../ui/toast';
import {
  CompEvent,
  Competition,
  eventLabel,
  euro,
  normalizeTime,
  sexLabel,
  yearFits,
} from '../../competition.models';
import { CompetitionStore } from '../../competition.store';

/** The starts of one swimmer at one meet: tick the events, type the entry times, save. */
@Component({
  selector: 'app-entry-form',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entry-form.html',
  styleUrl: './entry-form.scss',
})
export class EntryForm {
  protected readonly store = inject(CompetitionStore);
  private readonly people = inject(PeopleStore);
  private readonly toasts = inject(Toasts);

  readonly competition = input.required<Competition>();
  readonly personId = input.required<string>();
  readonly saved = output();

  protected readonly euro = euro;
  protected readonly eventLabel = eventLabel;
  protected readonly sexLabel = sexLabel;
  protected readonly showAll = signal(false);
  protected readonly bad = signal<ReadonlySet<number>>(new Set());

  /** The picks being edited: event number to entry time. Starts from what is saved. */
  protected readonly picks = linkedSignal<Map<number, string>>(() => {
    this.store.entries();
    return new Map(
      this.store
        .entriesOf(this.competition().id, this.personId())
        .map((entry) => [entry.eventNo, entry.time] as const),
    );
  });

  protected readonly declined = computed(() => {
    this.store.declines();
    return this.store.isDeclined(this.competition().id, this.personId());
  });

  protected readonly editable = computed(
    () => this.store.canManage() || this.store.canRegister(this.competition()),
  );

  private readonly member = computed(() => this.people.member(this.personId()));

  private fits(event: CompEvent): boolean {
    const member = this.member();
    if (!member) return true;
    const sexOk = event.sex === 'X' || member.sex === 'X' || event.sex === member.sex;
    return sexOk && yearFits(event.birthYears, Number(member.birthDate.slice(0, 4)));
  }

  protected readonly rows = computed(() => {
    const competition = this.competition();
    const picks = this.picks();
    return competition.events
      .filter((event) => this.showAll() || this.fits(event) || picks.has(event.no))
      .map((event) => ({ event, fits: this.fits(event), picked: picks.has(event.no) }));
  });

  protected readonly hidden = computed(() => this.competition().events.length - this.rows().length);

  protected readonly dirty = computed(() => {
    const saved = this.store.entriesOf(this.competition().id, this.personId());
    const picks = this.picks();
    return (
      saved.length !== picks.size || saved.some((entry) => picks.get(entry.eventNo) !== entry.time)
    );
  });

  protected readonly fee = computed(() => {
    const competition = this.competition();
    const picked = [...this.picks().keys()];
    const sum = picked.reduce(
      (total, no) => total + (competition.events.find((event) => event.no === no)?.fee ?? 0),
      0,
    );
    return picked.length > 0 ? sum + competition.perSwimmerFee : 0;
  });

  protected toggle(event: CompEvent): void {
    this.picks.update((current) => {
      const next = new Map(current);
      if (next.has(event.no)) next.delete(event.no);
      else next.set(event.no, '');
      return next;
    });
  }

  protected setTime(event: CompEvent, input: Event): void {
    const field = input.target as HTMLInputElement;
    const time = normalizeTime(field.value);
    this.bad.update((set) => {
      const next = new Set(set);
      if (time === null) next.add(event.no);
      else next.delete(event.no);
      return next;
    });
    if (time === null) return;
    field.value = time;
    this.picks.update((current) => new Map(current).set(event.no, time));
  }

  protected save(): void {
    if (this.bad().size > 0) {
      this.toasts.show('Bitte die rot markierten Meldezeiten prüfen.', 'bad');
      return;
    }
    const list = [...this.picks()].map(([eventNo, time]) => ({ eventNo, time }));
    this.store.setEntries(this.competition().id, this.personId(), list);
    this.toasts.saved(list.length > 0 ? 'Anmeldung gespeichert' : 'Keine Starts mehr gemeldet');
    this.saved.emit();
  }

  protected cancel(): void {
    this.picks.set(
      new Map(
        this.store
          .entriesOf(this.competition().id, this.personId())
          .map((entry) => [entry.eventNo, entry.time] as const),
      ),
    );
    this.bad.set(new Set());
    this.toasts.cancelled();
  }

  protected decline(): void {
    this.store.setDeclined(this.competition().id, this.personId(), true);
    this.toasts.show('Abgemeldet', 'info');
    this.saved.emit();
  }

  protected rejoin(): void {
    this.store.setDeclined(this.competition().id, this.personId(), false);
  }
}
