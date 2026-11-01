import { TestBed } from '@angular/core/testing';
import { PeopleStore } from '../people/people.store';
import { fullName } from '../people/people.models';
import { availableOf, isLow, missingOf } from './equipment.models';
import { EquipmentStore, LoanDraft } from './equipment.store';

describe('EquipmentStore', () => {
  function create() {
    TestBed.resetTestingModule();
    return TestBed.inject(EquipmentStore);
  }

  const item = (store: EquipmentStore, title: string) => {
    const found = store.items().find((entry) => entry.title === title);
    if (!found) throw new Error(`no item ${title}`);
    return found;
  };

  const draft = (extra: Partial<LoanDraft> = {}): LoanDraft => ({
    who: 'Anna Brandt',
    count: 1,
    piece: '',
    since: '',
    until: '',
    note: '',
    ...extra,
  });

  it('counts what is available from the stock minus the lent amount', () => {
    const store = create();
    expect(availableOf(item(store, 'Schwimmbretter blau'))).toBe(22);
  });

  it('counts numbered pieces one by one', () => {
    const store = create();
    expect(availableOf(item(store, 'Stoppuhr'))).toBe(3);
  });

  it('knows which items are below their minimum and how many are missing', () => {
    const store = create();
    const medals = item(store, 'Medaillen');
    expect(isLow(medals)).toBe(true);
    expect(missingOf(medals)).toBe(22);
    expect(isLow(item(store, 'Stoppuhr'))).toBe(false);
  });

  it('puts low items and hand-picked items on the shopping list', () => {
    const store = create();
    expect(store.shopping().map((entry) => entry.title)).toEqual([
      'Erste-Hilfe-Koffer',
      'Medaillen',
      'Verlängerungskabel 10 m',
    ]);
  });

  it('only lends to people from the member list', () => {
    const store = create();
    const pull = item(store, 'Pull-Buoys');
    expect(store.lend(pull.id, draft({ who: 'Unbekannte Person' }))).toBe(false);
    expect(item(store, 'Pull-Buoys').loans).toHaveLength(0);
    expect(store.loanProblem(pull, draft({ who: 'Unbekannte Person' }), null)).toContain(
      'steht nicht in der Mitgliederliste',
    );
  });

  it('accepts a member number or a differently written name and stores the name', () => {
    const store = create();
    const anna = TestBed.inject(PeopleStore)
      .members()
      .find((member) => fullName(member) === 'Anna Brandt');
    expect(store.memberName(String(anna?.memberNo))).toBe('Anna Brandt');
    expect(store.memberName('  anna BRANDT ')).toBe('Anna Brandt');
    expect(store.memberName('')).toBeNull();
    const pull = item(store, 'Pull-Buoys');
    expect(store.lend(pull.id, draft({ who: 'anna brandt', count: 2 }))).toBe(true);
    expect(item(store, 'Pull-Buoys').loans[0].who).toBe('Anna Brandt');
    expect(availableOf(item(store, 'Pull-Buoys'))).toBe(16);
  });

  it('does not lend more than is available', () => {
    const store = create();
    const pull = item(store, 'Pull-Buoys');
    expect(store.loanProblem(pull, draft({ count: 19 }), null)).toBe(
      'So viele sind nicht verfügbar (18).',
    );
    expect(store.loanProblem(pull, draft({ count: 0 }), null)).toBe('Bitte die Anzahl prüfen.');
  });

  it('lends a numbered piece only once', () => {
    const store = create();
    const watch = item(store, 'Stoppuhr');
    expect(store.loanProblem(watch, draft({ piece: 'Nr. 2' }), null)).toBe(
      'Nr. 2 ist schon verliehen.',
    );
    expect(store.loanProblem(watch, draft({ piece: 'Nr. 3' }), null)).toBe('');
    expect(store.loanProblem(watch, draft(), null)).toBe('Bitte ein Stück wählen.');
  });

  it('rejects a return date before the date of handing out', () => {
    const store = create();
    const pull = item(store, 'Pull-Buoys');
    expect(store.loanProblem(pull, draft({ since: '2026-05-10', until: '2026-05-01' }), null)).toBe(
      'Das Rückgabedatum liegt vor dem Ausgabedatum.',
    );
  });

  it('keeps a changed loan within the limits, counting its own amount as free', () => {
    const store = create();
    const blue = item(store, 'Schwimmbretter blau');
    const loan = blue.loans[0];
    expect(store.loanProblem(blue, draft({ who: loan.who, count: 24 }), loan)).toBe('');
    expect(store.loanProblem(blue, draft({ who: loan.who, count: 25 }), loan)).toBe(
      'So viele sind nicht verfügbar (24).',
    );
    expect(store.changeLoan(blue.id, loan.id, draft({ who: loan.who, count: 5 }))).toBe(true);
    expect(item(store, 'Schwimmbretter blau').loans[0].count).toBe(5);
  });

  it('moves a returned loan to the short history', () => {
    const store = create();
    const watch = item(store, 'Stoppuhr');
    store.giveBack(watch.id, watch.loans[0].id);
    const after = item(store, 'Stoppuhr');
    expect(after.loans).toHaveLength(0);
    expect(after.history[0]).toMatchObject({
      who: 'Jonas Weber',
      piece: 'Nr. 2',
      back: store.today,
    });
    expect(after.history).toHaveLength(2);
  });

  it('raises the stock when something was bought and takes it off the list', () => {
    const store = create();
    const medals = item(store, 'Medaillen');
    store.bought(medals.id);
    const after = item(store, 'Medaillen');
    expect(after.stock).toBe(30);
    expect(store.shopping().map((entry) => entry.title)).not.toContain('Medaillen');
    const cable = item(store, 'Verlängerungskabel 10 m');
    store.bought(cable.id);
    expect(item(store, 'Verlängerungskabel 10 m')).toMatchObject({ stock: 3, toBuy: false });
  });

  it('groups the loans by person and finds the overdue ones', () => {
    const store = create();
    const names = store.borrowers().map((borrower) => borrower.name);
    expect(names).toEqual(['Jonas Weber', 'Mia Vogel']);
    expect(store.borrowers()[0].overdue).toBe(true);
    expect(store.borrowers()[1].overdue).toBe(false);
    expect(store.overdueCount()).toBe(1);
  });

  it('follows the pieces when an item with numbered pieces is saved', () => {
    const store = create();
    const watch = item(store, 'Stoppuhr');
    store.save({ ...watch, pieces: [...watch.pieces, 'Nr. 5'], stock: 1 });
    expect(item(store, 'Stoppuhr').stock).toBe(5);
  });

  it('adds new items with their own id and removes them again', () => {
    const store = create();
    store.save({ ...item(store, 'Waffeleisen'), id: '', title: 'Zelt' });
    const added = item(store, 'Zelt');
    expect(added.id).toMatch(/^m-/);
    store.remove(added.id);
    expect(store.items().some((entry) => entry.title === 'Zelt')).toBe(false);
  });

  it('takes one badge off the stock, but never below zero and never when it is not kept', () => {
    const store = create();
    store.takeBadge('DSA Bronze');
    expect(store.badges().find((badge) => badge.name === 'DSA Bronze')?.stock).toBe(11);
    store.takeBadge('Totenkopf 2 Std.');
    expect(store.badges().find((badge) => badge.name === 'Totenkopf 2 Std.')?.stock).toBeNull();
    store.saveBadge({ name: 'DSA Gold', stock: 0, minimum: 5 });
    store.takeBadge('DSA Gold');
    expect(store.badges().find((badge) => badge.name === 'DSA Gold')?.stock).toBe(0);
  });

  it('lists badges that are at or below their minimum', () => {
    const store = create();
    expect(store.lowBadges().map((badge) => badge.name)).toEqual([
      'DSA Gold',
      'DLA Silber',
      'DLA Gold',
    ]);
  });
});
