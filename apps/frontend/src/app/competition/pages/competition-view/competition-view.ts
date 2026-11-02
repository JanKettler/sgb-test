import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { euro } from '../../../core/money';
import { PeopleStore } from '../../../people/people.store';
import { fullDate } from '../../../training/training-dates';
import { GROUPS } from '../../../training/training.models';
import { Action } from '../../../ui/action';
import { CompEvent, TIMINGS, eventLabel, sexLabel, showTime } from '../../competition.models';
import { CompetitionStore } from '../../competition.store';

/** One line of the facts: what it is and the text. */
interface Fact {
  label: string;
  text: string;
}

/** A person with the starts as readable lines. */
interface StarterView {
  id: string;
  name: string;
  year: string;
  starts: string[];
  issues: string[];
}

/** The judges and coaches of the club in one section. */
interface StaffView {
  section: number;
  judges: string[];
  coaches: string[];
  needed: number | null;
}

/**
 * A meet to look at: the data, sections, events, entries and the staff on one calm page, without
 * anything to change. Editing is a button away for those who may.
 */
@Component({
  selector: 'app-competition-view',
  imports: [Action],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './competition-view.html',
  styleUrl: './competition-view.scss',
})
export class CompetitionView {
  protected readonly store = inject(CompetitionStore);
  private readonly people = inject(PeopleStore);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');

  protected readonly item = computed(() => this.store.competition(this.id));
  protected readonly eventLabel = eventLabel;
  protected readonly sexLabel = sexLabel;
  protected readonly euro = euro;

  protected readonly firstDay = computed(() => {
    const dates = (this.item()?.sections ?? []).map((section) => section.date).filter(Boolean);
    return dates.length > 0 ? [...dates].sort()[0] : '';
  });

  protected readonly facts = computed<Fact[]>(() => {
    const item = this.item();
    if (!item) return [];
    const venue = [item.venueName, item.venueStreet, `${item.venueZip} ${item.venueCity}`.trim()]
      .filter(Boolean)
      .join(', ');
    const timing = TIMINGS.find((entry) => entry.key === item.timing)?.label ?? item.timing;
    const fees = [
      item.flatFee > 0 ? `Pauschale ${euro(item.flatFee)}` : '',
      item.perSwimmerFee > 0 ? `${euro(item.perSwimmerFee)} je Schwimmer` : '',
      item.discount > 0 ? `Rabatt ${euro(item.discount)}` : '',
      `bisher ${euro(this.store.totalFee(item))}`,
    ]
      .filter(Boolean)
      .join(' · ');
    const facts: Fact[] = [
      { label: 'Bahn', text: item.pool === 50 ? 'Langbahn (50 m)' : 'Kurzbahn (25 m)' },
      { label: 'Zeitnahme', text: timing },
      {
        label: 'Meldeschluss',
        text: `${this.date(item.deadline)}${item.deadlineTime ? `, ${item.deadlineTime} Uhr` : ''}`,
      },
      { label: 'Intern bis', text: this.date(item.internalDeadline) },
      { label: 'Anmeldung im Portal', text: this.registration() },
      { label: 'Veranstalter', text: item.organiser },
      { label: 'Ausrichter', text: item.host },
      { label: 'Wettkampfstätte', text: venue },
      {
        label: 'Kontakt',
        text: [item.contactName, item.contactEmail, item.contactPhone].filter(Boolean).join(' · '),
      },
      { label: 'Meldegeld', text: fees },
      { label: 'Gesendet', text: item.sent ? 'Meldung ist gesendet' : '' },
      { label: 'Hinweis', text: item.note },
    ];
    return facts.filter((fact) => fact.text.trim() !== '');
  });

  protected readonly starters = computed<StarterView[]>(() => {
    const item = this.item();
    if (!item) return [];
    return this.store.starters(item).map((row) => ({
      id: row.personId,
      name: row.name,
      year: this.people.member(row.personId)?.birthDate.slice(0, 4) ?? '–',
      starts: row.entries.map(
        (entry) =>
          `Wk ${entry.eventNo} ${this.startLabel(item.events, entry.eventNo)} · ${showTime(entry.time) || 'ohne Zeit'}`,
      ),
      issues: row.issues,
    }));
  });

  protected readonly relays = computed(() => {
    const item = this.item();
    if (!item) return [];
    return this.store.relaysOf(item.id).map((relay) => ({
      name: `${relay.team}. Mannschaft`,
      year: relay.year ? String(relay.year) : '–',
      start: `Wk ${relay.eventNo} ${this.startLabel(item.events, relay.eventNo)} · ${showTime(relay.time) || 'ohne Zeit'}`,
      members: relay.memberIds.map((id) => this.store.nameOf(id)).join(', '),
    }));
  });

  protected readonly staff = computed<StaffView[]>(() => {
    const item = this.item();
    if (!item) return [];
    const names = (ids: string[] | undefined) => (ids ?? []).map((id) => this.store.nameOf(id));
    return item.sections.map((section) => ({
      section: section.no,
      judges: names(item.officials[section.no]),
      coaches: names(item.coaches[section.no]),
      needed: item.plan.judges[section.no] ?? null,
    }));
  });

  protected readonly progress = computed(() => {
    const item = this.item();
    return item ? this.store.progress(item) : { done: 0, total: 0 };
  });
  protected readonly warnings = computed(() => {
    const item = this.item();
    return item ? this.store.warnings(item) : [];
  });

  /** "15.11.2026", empty for no date. */
  protected date(iso: string): string {
    return iso ? fullDate(iso) : '';
  }

  private registration(): string {
    const item = this.item();
    if (!item) return '';
    if (!item.open) return 'Gesperrt';
    if (item.groupIds.length === 0) return 'Alle';
    const names = item.groupIds.map((id) => GROUPS.find((group) => group.id === id)?.name ?? id);
    return `Nur ${names.join(', ')}`;
  }

  private startLabel(events: CompEvent[], no: number): string {
    const event = events.find((entry) => entry.no === no);
    return event ? eventLabel(event) : '–';
  }
}
