import { Injectable, computed, inject, signal } from '@angular/core';
import { EquipmentStore } from '../equipment/equipment.store';
import { PeopleStore } from '../people/people.store';
import { TrainingStore } from '../training/training.store';
import { CashStore } from './cash.store';
import { roundCents } from './cash.models';
import { BadgeKind, BadgeRecord, DEFAULT_CATALOG, emptyRecord, yearOf } from './youth.models';

/** All badges of one person. */
export interface PersonBadges {
  key: string;
  name: string;
  memberNo: string;
  records: BadgeRecord[];
}

/** One line of the yearly settlement: how many badges of a kind were paid and what that makes. */
export interface SummaryRow {
  badge: string;
  price: number;
  count: number;
  sum: number;
  names: string[];
}

function copyKind(kind: BadgeKind): BadgeKind {
  return { ...kind, requirements: [...kind.requirements] };
}

/** In-memory stand-in for the future youth API. All data is invented. */
@Injectable({ providedIn: 'root' })
export class YouthStore {
  private readonly cash = inject(CashStore);
  private readonly equipment = inject(EquipmentStore);
  private readonly people = inject(PeopleStore);
  private readonly training = inject(TrainingStore);
  private counter = 100;
  readonly today = this.training.today;

  /** Youth workers and the board enter badges and book the money. */
  readonly canEdit = this.training.canManage;
  readonly memberNames = this.people.memberNames;

  readonly catalog = signal<BadgeKind[]>(DEFAULT_CATALOG.map(copyKind));
  readonly records = signal<BadgeRecord[]>(this.sampleRecords());
  /** The year of the settlement; paid badges of other years are not shown with the person. */
  readonly year = signal(Number(this.today.slice(0, 4)));

  readonly kindNames = computed(() => this.catalog().map((kind) => kind.name));
  readonly workingCount = computed(
    () => this.records().filter((record) => record.state === 'laufend').length,
  );
  readonly dueRecords = computed(() =>
    this.records().filter((record) => record.state === 'bestanden'),
  );
  readonly dueSum = computed(() =>
    roundCents(this.dueRecords().reduce((sum, record) => sum + this.priceOf(record), 0)),
  );

  /** The people who have at least one badge, by name. */
  readonly persons = computed<PersonBadges[]>(() => {
    const groups = new Map<string, PersonBadges>();
    for (const record of this.records()) {
      const key = record.name.toLocaleLowerCase('de');
      const group = groups.get(key) ?? {
        key,
        name: record.name,
        memberNo: record.memberNo,
        records: [],
      };
      group.records.push(record);
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  });

  kindOf(name: string): BadgeKind {
    return (
      this.catalog().find((kind) => kind.name === name) ?? { name, price: 0, requirements: [] }
    );
  }

  priceOf(record: BadgeRecord): number {
    return record.price ?? this.kindOf(record.badge).price;
  }

  /** The records that are shown with a person: all open ones and the paid ones of the year. */
  visibleOf(person: PersonBadges): BadgeRecord[] {
    const year = String(this.year());
    return person.records.filter(
      (record) => record.state !== 'bezahlt' || yearOf(record.paidOn || record.date) === year,
    );
  }

  /** What was paid in the year, per kind of badge. */
  summaryOf(year: number): SummaryRow[] {
    const paid = this.paidIn(year).filter((record) => record.state === 'bezahlt');
    const kinds = new Set([...this.kindNames(), ...paid.map((record) => record.badge)]);
    return [...kinds].map((badge) => {
      const mine = paid.filter((record) => record.badge === badge);
      return {
        badge,
        price: this.kindOf(badge).price,
        count: mine.length,
        sum: roundCents(mine.reduce((sum, record) => sum + this.priceOf(record), 0)),
        names: mine.map((record) => record.name),
      };
    });
  }

  /** Passed or paid badges of the year, the newest first. */
  paidIn(year: number): BadgeRecord[] {
    return this.records()
      .filter(
        (record) =>
          record.state !== 'laufend' && yearOf(record.paidOn || record.date) === String(year),
      )
      .sort((a, b) => (b.paidOn || b.date).localeCompare(a.paidOn || a.date));
  }

  /** What the youth cash has booked for paid badges in the year. */
  bookedIn(year: number): number {
    return roundCents(
      this.cash
        .entries()
        .filter(
          (entry) =>
            entry.kind === 'in' &&
            entry.ref.startsWith('abz:') &&
            yearOf(entry.date) === String(year),
        )
        .reduce((sum, entry) => sum + entry.amount, 0),
    );
  }

  /** What is wrong with a typed name or member number; empty when it is in the member list. */
  nameProblem(typed: string, keep = ''): string {
    return this.people.resolveName(typed, keep)
      ? ''
      : `„${typed}“ steht nicht in der Mitgliederliste. Bitte einen Namen oder eine Mitgliedsnummer aus der Vorschlagsliste wählen.`;
  }

  /** Why a payment of this price cannot be booked right now; empty when it can. */
  payProblem(price: number): string {
    return price > 0 && this.cash.isClosed(this.today)
      ? 'Der Monat in der Jugendkasse ist abgeschlossen.'
      : '';
  }

  /**
   * Saves a record. `typed` is the name or member number as it was typed; it has to be in the member
   * list. Returns what is wrong, or an empty text when it was saved.
   */
  saveRecord(record: BadgeRecord, typed: string): string {
    const name = this.people.resolveName(typed, record.name);
    if (!name) return this.nameProblem(typed, record.name);
    const complete: BadgeRecord = {
      ...record,
      name,
      memberNo: this.people.memberNoOf(name) || record.memberNo,
    };
    if (complete.id) {
      this.records.update((list) =>
        list.map((item) => (item.id === complete.id ? complete : item)),
      );
      return '';
    }
    const id = `r-${++this.counter}`;
    if (complete.state !== 'bezahlt') {
      this.records.update((list) => [...list, { ...complete, id }]);
      return '';
    }
    return this.payNew({ ...complete, id });
  }

  removeRecord(id: string): void {
    this.records.update((list) => list.filter((record) => record.id !== id));
  }

  toggleRequirement(id: string, index: number): void {
    this.patch(id, (record) => ({
      ...record,
      done: record.done.includes(index)
        ? record.done.filter((entry) => entry !== index)
        : [...record.done, index].sort((a, b) => a - b),
    }));
  }

  markPassed(id: string): void {
    this.patch(id, (record) => ({ ...record, state: 'bestanden', date: this.today }));
  }

  /** The badge was paid in cash: book the money in the youth cash and take one from the stock. */
  markPaid(id: string): string {
    const record = this.records().find((entry) => entry.id === id);
    if (!record) return '';
    const paid: BadgeRecord = { ...record, state: 'bezahlt', paidOn: this.today };
    const problem = this.bookPayment(paid);
    if (problem) return problem;
    this.patch(id, () => paid);
    this.equipment.takeBadge(paid.badge);
    return '';
  }

  saveKind(kind: BadgeKind): void {
    this.catalog.update((list) =>
      list.map((entry) => (entry.name === kind.name ? copyKind(kind) : entry)),
    );
  }

  /** Adds a kind of badge; returns what is wrong, or an empty text when it was added. */
  addKind(kind: BadgeKind): string {
    if (!kind.name) return 'Bitte einen Namen eintragen.';
    if (this.kindNames().includes(kind.name)) return 'Dieses Abzeichen gibt es schon.';
    this.catalog.update((list) => [...list, copyKind(kind)]);
    this.equipment.addBadge(kind.name);
    return '';
  }

  private payNew(record: BadgeRecord): string {
    const paid: BadgeRecord = { ...record, paidOn: this.today, date: record.date || this.today };
    const problem = this.bookPayment(paid);
    if (problem) return problem;
    this.records.update((list) => [...list, paid]);
    this.equipment.takeBadge(paid.badge);
    return '';
  }

  private bookPayment(record: BadgeRecord): string {
    const price = this.priceOf(record);
    if (price <= 0) return '';
    return this.cash.book({
      kind: 'in',
      amount: price,
      date: this.today,
      category: 'Abzeichen',
      text: `Abzeichen ${record.badge}: ${record.name} (bar)`,
      receipt: '',
      ref: `abz:${record.id}`,
    });
  }

  private patch(id: string, change: (record: BadgeRecord) => BadgeRecord): void {
    this.records.update((list) =>
      list.map((record) => (record.id === id ? change(record) : record)),
    );
  }

  private sampleRecords(): BadgeRecord[] {
    const make = (data: Partial<BadgeRecord> & { id: string; name: string; badge: string }) => ({
      ...emptyRecord(this.today, data.badge),
      memberNo: this.people.memberNoOf(data.name),
      ...data,
    });
    return [
      make({ id: 'r-1', name: 'Mia Vogel', badge: 'DSA Bronze', done: [0, 1, 3] }),
      make({
        id: 'r-2',
        name: 'Mats Hartmann',
        badge: 'DSA Silber',
        state: 'bestanden',
        done: [0, 1, 2, 3, 4, 5, 6],
      }),
      make({
        id: 'r-3',
        name: 'Mira Köhler',
        badge: 'DLA Hai',
        state: 'bezahlt',
        paidOn: this.today,
      }),
      make({
        id: 'r-4',
        name: 'Tobias Lorenz',
        badge: 'Totenkopf 1 Std.',
        note: 'Probe nächste Woche',
      }),
      make({
        id: 'r-5',
        name: 'Anna Brandt',
        badge: 'DSA Gold',
        done: [0, 1, 2],
        note: 'Theorie fehlt',
      }),
    ];
  }
}
