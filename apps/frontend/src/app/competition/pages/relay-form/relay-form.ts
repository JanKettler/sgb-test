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
  Competition,
  RelayEntry,
  eventLabel,
  normalizeTime,
  sexLabel,
} from '../../competition.models';
import { CompetitionStore } from '../../competition.store';

/** One relay team: the event, team number, age class, entry time and the swimmers. */
@Component({
  selector: 'app-relay-form',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let event = current();
    <div class="columns is-multiline">
      <div class="column is-full">
        <label class="label" for="relay-event">Staffel</label>
        <div class="select is-fullwidth">
          <select id="relay-event" (change)="pickEvent($event)">
            @for (item of relayEvents(); track item.no) {
              <option [value]="item.no" [selected]="item.no === eventNo()">
                Wk {{ item.no }} · {{ label(item) }} · {{ sex(item.sex) }}
              </option>
            }
          </select>
        </div>
      </div>
      <div class="column is-4">
        <label class="label" for="relay-team">Mannschaft</label>
        <input
          id="relay-team"
          class="input"
          type="number"
          min="1"
          [value]="team()"
          (change)="team.set(number($event, 1))"
        />
      </div>
      <div class="column is-4">
        <label class="label" for="relay-year">Jahrgang</label>
        <input
          id="relay-year"
          class="input"
          inputmode="numeric"
          [value]="year()"
          (change)="year.set(number($event, 0))"
        />
      </div>
      <div class="column is-4">
        <label class="label" for="relay-time">Meldezeit</label>
        <input
          id="relay-time"
          class="input"
          [class.is-danger]="badTime()"
          inputmode="decimal"
          placeholder="mm:ss,hh"
          [value]="time()"
          (change)="setTime($event)"
        />
      </div>
      @for (slot of slots(); track slot) {
        <div class="column is-6">
          <label class="label" [for]="'relay-m' + slot">Schwimmer {{ slot + 1 }}</label>
          <div class="select is-fullwidth">
            <select [id]="'relay-m' + slot" (change)="setMember(slot, $event)">
              <option value="">– offen –</option>
              @for (person of candidates; track person.id) {
                <option [value]="person.id" [selected]="members()[slot] === person.id">
                  {{ person.name }}
                </option>
              }
            </select>
          </div>
        </div>
      }
    </div>
    @for (issue of issues(); track issue) {
      <span class="pill is-warn mr-1">{{ issue }}</span>
    }
    <div class="icon-row mt-3">
      <button
        type="button"
        class="button is-danger"
        title="Abbrechen"
        aria-label="Abbrechen"
        (click)="cancelled.emit()"
      >
        <app-icon name="x" />
      </button>
      <button
        type="button"
        class="button is-success"
        title="Speichern"
        aria-label="Speichern"
        [disabled]="!event"
        (click)="save()"
      >
        <app-icon name="save" />
      </button>
    </div>
  `,
})
export class RelayForm {
  private readonly store = inject(CompetitionStore);
  private readonly people = inject(PeopleStore);
  private readonly toasts = inject(Toasts);

  readonly competition = input.required<Competition>();
  /** The team to change; empty for a new team. */
  readonly relay = input<RelayEntry | null>(null);
  readonly saved = output();
  readonly cancelled = output();

  protected readonly label = eventLabel;
  protected readonly sex = sexLabel;
  protected readonly candidates = this.store.relayCandidates();

  protected readonly relayEvents = computed(() =>
    this.competition().events.filter((item) => item.count > 1),
  );
  protected readonly eventNo = linkedSignal(
    () => this.relay()?.eventNo ?? this.relayEvents()[0]?.no ?? 0,
  );
  protected readonly team = linkedSignal(() => this.relay()?.team ?? this.nextTeam(this.eventNo()));
  protected readonly year = linkedSignal(() => this.relay()?.year ?? 0);
  protected readonly time = linkedSignal(() => this.relay()?.time ?? '');
  protected readonly badTime = signal(false);
  protected readonly members = linkedSignal<string[]>(() => [...(this.relay()?.memberIds ?? [])]);

  protected readonly current = computed(() =>
    this.competition().events.find((item) => item.no === this.eventNo()),
  );
  protected readonly slots = computed(() =>
    Array.from({ length: this.current()?.count ?? 4 }, (_, index) => index),
  );
  protected readonly issues = computed(() => {
    const event = this.current();
    if (!event) return ['Keine Staffel in der Wettkampffolge'];
    return this.store.relayIssues(this.competition(), this.draft());
  });

  private nextTeam(eventNo: number): number {
    return (
      this.store.relaysOf(this.competition().id).filter((item) => item.eventNo === eventNo).length +
      1
    );
  }

  private draft(): RelayEntry {
    return {
      competitionId: this.competition().id,
      eventNo: this.eventNo(),
      team: this.team(),
      year: this.year(),
      time: this.time(),
      memberIds: this.members().filter(Boolean),
    };
  }

  protected number(event: Event, fallback: number): number {
    const value = Number((event.target as HTMLInputElement).value);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  protected pickEvent(event: Event): void {
    const no = Number((event.target as HTMLSelectElement).value);
    this.eventNo.set(no);
  }

  protected setTime(event: Event): void {
    const field = event.target as HTMLInputElement;
    const time = normalizeTime(field.value);
    this.badTime.set(time === null);
    if (time === null) return;
    field.value = time;
    this.time.set(time);
  }

  protected setMember(slot: number, event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.members.update((list) => {
      const next = [...list];
      next[slot] = id;
      return next;
    });
    if (this.year() === 0) {
      const years = this.members()
        .filter(Boolean)
        .map((member) => Number(this.people.member(member)?.birthDate.slice(0, 4)));
      if (years.length > 0) this.year.set(Math.max(...years));
    }
  }

  protected save(): void {
    if (this.badTime() || !this.current()) {
      this.toasts.show('Bitte die Meldezeit prüfen.', 'bad');
      return;
    }
    const draft = this.draft();
    const duplicate = this.store
      .relaysOf(draft.competitionId)
      .some(
        (item) =>
          item !== this.relay() && item.eventNo === draft.eventNo && item.team === draft.team,
      );
    if (duplicate) {
      this.toasts.show('Diese Mannschaft gibt es für den Wettkampf schon.', 'bad');
      return;
    }
    this.store.saveRelay(draft, this.relay() ?? undefined);
    this.toasts.saved('Staffel gespeichert');
    this.saved.emit();
  }
}
