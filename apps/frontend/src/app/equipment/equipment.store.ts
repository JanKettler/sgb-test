import { Injectable, computed, inject, signal } from '@angular/core';
import { PeopleStore } from '../people/people.store';
import { fullName } from '../people/people.models';
import { addDays } from '../training/training-dates';
import { TrainingStore } from '../training/training.store';
import {
  BADGE_NAMES,
  BadgeStock,
  EquipmentItem,
  Loan,
  ReturnedLoan,
  availableOf,
  isOverdue,
  needsBuying,
} from './equipment.models';

/** The longest history kept per item. */
const HISTORY_LENGTH = 15;

/** Everything one person has lent from the club. */
export interface Borrower {
  name: string;
  memberNo: string;
  loans: { item: EquipmentItem; loan: Loan }[];
  /** Earliest agreed return date, or empty. */
  until: string;
  overdue: boolean;
}

/** Material that is noted in the member list (jacket, swim board); it is returned there. */
export interface MemberMaterial {
  name: string;
  memberNo: string;
  material: string;
  since: string;
}

export interface LoanDraft {
  who: string;
  count: number;
  piece: string;
  since: string;
  until: string;
  note: string;
}

function byTitle(a: EquipmentItem, b: EquipmentItem): number {
  return a.title.localeCompare(b.title, 'de');
}

function key(name: string): string {
  return name.trim().toLocaleLowerCase('de');
}

/** In-memory stand-in for the future material API. All data is invented. */
@Injectable({ providedIn: 'root' })
export class EquipmentStore {
  private readonly training = inject(TrainingStore);
  private readonly people = inject(PeopleStore);
  private counter = 100;
  readonly today = this.training.today;

  /** The board changes the list of items; everybody who manages the club lends and takes back. */
  readonly canEdit = this.training.isAdmin;
  readonly canLend = this.training.canManage;

  readonly items = signal<EquipmentItem[]>(this.sample());
  readonly badges = signal<BadgeStock[]>(this.sampleBadges());

  readonly sorted = computed(() => [...this.items()].sort(byTitle));
  readonly shopping = computed(() => this.sorted().filter(needsBuying));
  readonly lentCount = computed(() => this.items().filter((item) => item.loans.length > 0).length);
  readonly overdueCount = computed(
    () =>
      this.items()
        .flatMap((item) => item.loans)
        .filter((loan) => isOverdue(loan, this.today)).length,
  );
  readonly lowBadges = computed(() =>
    this.badges().filter(
      (badge) => badge.stock !== null && badge.minimum !== null && badge.stock <= badge.minimum,
    ),
  );

  /** Names that may be typed into the "who" field. */
  readonly memberNames = computed(() =>
    this.people
      .activeMembers()
      .map((member) => fullName(member))
      .sort((a, b) => a.localeCompare(b, 'de')),
  );

  /** Everybody who has something lent, with the loans sorted by name. */
  readonly borrowers = computed<Borrower[]>(() => {
    const byName = new Map<string, Borrower>();
    for (const item of this.items()) {
      for (const loan of item.loans) {
        const found = byName.get(key(loan.who));
        const borrower = found ?? {
          name: loan.who,
          memberNo: this.memberNoOf(loan.who),
          loans: [],
          until: '',
          overdue: false,
        };
        borrower.loans.push({ item, loan });
        byName.set(key(loan.who), borrower);
      }
    }
    return [...byName.values()]
      .map((borrower) => ({
        ...borrower,
        until:
          borrower.loans
            .map((entry) => entry.loan.until)
            .filter(Boolean)
            .sort()[0] ?? '',
        overdue: borrower.loans.some((entry) => isOverdue(entry.loan, this.today)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  });

  /** What the member list says was handed out, e.g. jackets and swim boards. */
  readonly memberMaterial = computed<MemberMaterial[]>(() =>
    this.people
      .activeMembers()
      .flatMap((member) =>
        member.material.map((entry) => ({
          name: fullName(member),
          memberNo: String(member.memberNo),
          material: entry.name,
          since: entry.since,
        })),
      )
      .sort(
        (a, b) => a.name.localeCompare(b.name, 'de') || a.material.localeCompare(b.material, 'de'),
      ),
  );

  /**
   * The name as it is written in the member list, for a typed name or a member number; null
   * when nobody matches. `keep` is a name that stays valid, e.g. of a loan that already exists.
   */
  memberName(typed: string, keep = ''): string | null {
    const text = typed.trim();
    if (!text) return null;
    if (keep && key(keep) === key(text)) return keep;
    const members = this.people.activeMembers();
    const byNumber = /^\d+$/.test(text)
      ? members.find((member) => String(member.memberNo) === text)
      : undefined;
    const member = byNumber ?? members.find((entry) => key(fullName(entry)) === key(text));
    return member ? fullName(member) : null;
  }

  private memberNoOf(name: string): string {
    const member = this.people.activeMembers().find((entry) => key(fullName(entry)) === key(name));
    return member ? String(member.memberNo) : '';
  }

  /** The reason a loan cannot be saved, or an empty text when it can. */
  loanProblem(item: EquipmentItem, draft: LoanDraft, editing: Loan | null): string {
    if (draft.until && draft.since && draft.until < draft.since) {
      return 'Das Rückgabedatum liegt vor dem Ausgabedatum.';
    }
    if (this.memberName(draft.who, editing?.who ?? '') === null) {
      return `„${draft.who}“ steht nicht in der Mitgliederliste. Bitte einen Namen oder eine Mitgliedsnummer aus der Vorschlagsliste wählen.`;
    }
    if (item.pieces.length > 0) {
      const taken = item.loans.some(
        (loan) => loan.piece === draft.piece && loan.id !== editing?.id,
      );
      if (!item.pieces.includes(draft.piece)) return 'Bitte ein Stück wählen.';
      return taken ? `${draft.piece} ist schon verliehen.` : '';
    }
    if (!Number.isInteger(draft.count) || draft.count <= 0) return 'Bitte die Anzahl prüfen.';
    const free = availableOf(item) + (editing?.count ?? 0);
    return draft.count > free ? `So viele sind nicht verfügbar (${free}).` : '';
  }

  save(item: EquipmentItem): void {
    const prepared: EquipmentItem = {
      ...item,
      stock: item.pieces.length > 0 ? item.pieces.length : item.stock,
    };
    if (!prepared.id) {
      this.items.update((list) => [...list, { ...prepared, id: `m-${++this.counter}` }]);
      return;
    }
    this.items.update((list) => list.map((entry) => (entry.id === prepared.id ? prepared : entry)));
  }

  remove(id: string): void {
    this.items.update((list) => list.filter((entry) => entry.id !== id));
  }

  setStock(id: string, stock: number): void {
    this.patch(id, (item) => ({ ...item, stock }));
  }

  /** Lends the item; returns false when the loan is not valid. */
  lend(id: string, draft: LoanDraft): boolean {
    return this.writeLoan(id, draft, null);
  }

  /** Changes a loan that is still out; returns false when the change is not valid. */
  changeLoan(id: string, loanId: string, draft: LoanDraft): boolean {
    const item = this.items().find((entry) => entry.id === id);
    const loan = item?.loans.find((entry) => entry.id === loanId);
    return loan ? this.writeLoan(id, draft, loan) : false;
  }

  giveBack(id: string, loanId: string): void {
    this.patch(id, (item) => {
      const loan = item.loans.find((entry) => entry.id === loanId);
      if (!loan) return item;
      const returned: ReturnedLoan = {
        who: loan.who,
        count: loan.count,
        piece: loan.piece,
        since: loan.since,
        back: this.today,
      };
      return {
        ...item,
        loans: item.loans.filter((entry) => entry.id !== loanId),
        history: [returned, ...item.history].slice(0, HISTORY_LENGTH),
      };
    });
  }

  /** The purchase is done: the stock grows by what was missing and the item leaves the list. */
  bought(id: string): void {
    this.patch(id, (item) => {
      const missing = item.minimum === null ? 0 : Math.max(0, item.minimum - availableOf(item));
      return { ...item, stock: item.stock + missing, toBuy: false };
    });
  }

  saveBadge(badge: BadgeStock): void {
    this.badges.update((list) => list.map((entry) => (entry.name === badge.name ? badge : entry)));
  }

  /** One badge less on the shelf, e.g. when it was paid on the youth page. */
  takeBadge(name: string): void {
    this.badges.update((list) =>
      list.map((entry) =>
        entry.name === name && entry.stock !== null
          ? { ...entry, stock: Math.max(0, entry.stock - 1) }
          : entry,
      ),
    );
  }

  private writeLoan(id: string, draft: LoanDraft, editing: Loan | null): boolean {
    const item = this.items().find((entry) => entry.id === id);
    if (!item || this.loanProblem(item, draft, editing)) return false;
    const who = this.memberName(draft.who, editing?.who ?? '') ?? draft.who;
    const loan: Loan = {
      id: editing?.id ?? `l-${++this.counter}`,
      who,
      count: item.pieces.length > 0 ? 1 : draft.count,
      piece: item.pieces.length > 0 ? draft.piece : '',
      since: draft.since || editing?.since || this.today,
      until: draft.until,
      note: draft.note,
    };
    this.patch(id, (current) => ({
      ...current,
      loans: editing
        ? current.loans.map((entry) => (entry.id === editing.id ? loan : entry))
        : [...current.loans, loan],
    }));
    return true;
  }

  private patch(id: string, change: (item: EquipmentItem) => EquipmentItem): void {
    this.items.update((list) => list.map((item) => (item.id === id ? change(item) : item)));
  }

  private sampleBadges(): BadgeStock[] {
    const stock = [12, 9, 4, 15, 3, 2, 20, 7, null];
    return BADGE_NAMES.map((name, index) => ({
      name,
      stock: stock[index] ?? null,
      minimum: index === 8 ? null : 5,
    }));
  }

  private sample(): EquipmentItem[] {
    const day = (offset: number) => addDays(this.today, offset);
    const item = (data: Partial<EquipmentItem> & { id: string; title: string }): EquipmentItem => ({
      category: '',
      place: '',
      stock: 1,
      minimum: null,
      unit: 'Stück',
      condition: 'gut',
      toBuy: false,
      pieces: [],
      note: '',
      loans: [],
      history: [],
      ...data,
    });
    const loan = (data: Partial<Loan> & { id: string; who: string }): Loan => ({
      count: 1,
      piece: '',
      since: day(-5),
      until: '',
      note: '',
      ...data,
    });
    return [
      item({
        id: 'm-1',
        title: 'Schwimmbretter rot',
        category: 'Training',
        place: 'Halle, Schrank 1',
        stock: 30,
        minimum: 20,
      }),
      item({
        id: 'm-2',
        title: 'Schwimmbretter blau',
        category: 'Training',
        place: 'Halle, Schrank 1',
        stock: 24,
        minimum: 20,
        loans: [loan({ id: 'l-1', who: 'Mia Vogel', count: 2, until: day(10) })],
      }),
      item({
        id: 'm-3',
        title: 'Pull-Buoys',
        category: 'Training',
        place: 'Halle, Schrank 2',
        stock: 18,
        minimum: 12,
      }),
      item({
        id: 'm-4',
        title: 'Stoppuhr',
        category: 'Wettkampf',
        place: 'Geschäftsstelle',
        pieces: ['Nr. 1', 'Nr. 2', 'Nr. 3', 'Nr. 4'],
        stock: 4,
        loans: [
          loan({ id: 'l-2', who: 'Jonas Weber', piece: 'Nr. 2', since: day(-20), until: day(-6) }),
        ],
        history: [
          { who: 'Anna Brandt', count: 1, piece: 'Nr. 1', since: day(-40), back: day(-33) },
        ],
      }),
      item({
        id: 'm-5',
        title: 'Waffeleisen',
        category: 'Küche',
        place: 'Vereinsraum',
        stock: 2,
        note: 'Für Feste und den Weihnachtsmarkt',
      }),
      item({
        id: 'm-6',
        title: 'Medaillen',
        category: 'Wettkampf',
        place: 'Geschäftsstelle',
        stock: 8,
        minimum: 30,
        unit: 'Stück',
      }),
      item({
        id: 'm-7',
        title: 'Verlängerungskabel 10 m',
        category: 'Technik',
        place: 'Keller',
        stock: 3,
        toBuy: true,
      }),
      item({
        id: 'm-8',
        title: 'Erste-Hilfe-Koffer',
        category: 'Sicherheit',
        place: 'Halle, Eingang',
        stock: 1,
        condition: 'defekt',
        note: 'Verbandmaterial ist abgelaufen',
        toBuy: true,
      }),
    ];
  }
}
