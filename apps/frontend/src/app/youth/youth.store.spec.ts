import { TestBed } from '@angular/core/testing';
import { EquipmentStore } from '../equipment/equipment.store';
import { PeopleStore } from '../people/people.store';
import { monthKey } from '../training/training-dates';
import { CashStore } from './cash.store';
import { emptyRecord } from './youth.models';
import { YouthStore } from './youth.store';

describe('YouthStore', () => {
  function create() {
    TestBed.resetTestingModule();
    return TestBed.inject(YouthStore);
  }

  const stockOf = (name: string) =>
    TestBed.inject(EquipmentStore)
      .badges()
      .find((badge) => badge.name === name)?.stock;

  it('groups the badges by person and sorts the people by name', () => {
    const store = create();
    expect(store.persons().map((person) => person.name)).toEqual([
      'Anna Brandt',
      'Mats Hartmann',
      'Mia Vogel',
      'Mira Köhler',
      'Tobias Lorenz',
    ]);
  });

  it('counts what is in work and what still has to be paid', () => {
    const store = create();
    expect(store.workingCount()).toBe(3);
    expect(store.dueRecords().map((record) => record.name)).toEqual(['Mats Hartmann']);
    expect(store.dueSum()).toBe(2);
  });

  it('takes the price of the badge unless the record has its own', () => {
    const store = create();
    const record = store.records().find((entry) => entry.id === 'r-3');
    expect(store.priceOf(record ?? emptyRecord('', ''))).toBe(3);
    expect(store.priceOf({ ...(record ?? emptyRecord('', '')), price: 4.5 })).toBe(4.5);
    expect(store.kindOf('Gibt es nicht')).toEqual({
      name: 'Gibt es nicht',
      price: 0,
      requirements: [],
    });
  });

  it('ticks a requirement on and off and keeps the numbers sorted', () => {
    const store = create();
    const done = () => store.records().find((entry) => entry.id === 'r-1')?.done;
    store.toggleRequirement('r-1', 2);
    expect(done()).toEqual([0, 1, 2, 3]);
    store.toggleRequirement('r-1', 1);
    expect(done()).toEqual([0, 2, 3]);
  });

  it('books a paid badge in the cash and takes one from the stock', () => {
    const store = create();
    const cash = TestBed.inject(CashStore);
    const before = stockOf('DSA Silber') ?? 0;
    expect(store.markPaid('r-2')).toBe('');
    expect(store.records().find((entry) => entry.id === 'r-2')).toMatchObject({
      state: 'bezahlt',
      paidOn: store.today,
    });
    const booking = cash.entries().find((entry) => entry.ref === 'abz:r-2');
    expect(booking).toMatchObject({ kind: 'in', amount: 2, category: 'Abzeichen', status: 'open' });
    expect(stockOf('DSA Silber')).toBe(before - 1);
    expect(store.dueRecords()).toHaveLength(0);
  });

  it('agrees with the youth cash: what was paid is what was booked', () => {
    const store = create();
    const year = Number(store.today.slice(0, 4));
    expect(store.bookedIn(year)).toBe(3);
    store.markPaid('r-2');
    const total = store.summaryOf(year).reduce((sum, row) => sum + row.sum, 0);
    expect(total).toBe(5);
    expect(store.bookedIn(year)).toBe(5);
  });

  it('does not mark a badge as paid when the month of the cash is closed', () => {
    const store = create();
    const cash = TestBed.inject(CashStore);
    cash.setEntryStatus('k-3', 'confirmed');
    cash.setEntryStatus('k-4', 'confirmed');
    cash.closeMonth(monthKey(store.today));
    const before = stockOf('DSA Silber');
    expect(store.markPaid('r-2')).toBe('Der Monat in der Jugendkasse ist abgeschlossen.');
    expect(store.records().find((entry) => entry.id === 'r-2')?.state).toBe('bestanden');
    expect(stockOf('DSA Silber')).toBe(before);
    expect(store.payProblem(2)).toBe('Der Monat in der Jugendkasse ist abgeschlossen.');
    expect(store.payProblem(0)).toBe('');
  });

  it('summarises the paid badges of a year per kind', () => {
    const store = create();
    const year = Number(store.today.slice(0, 4));
    const rows = store.summaryOf(year);
    expect(rows).toHaveLength(9);
    expect(rows.find((row) => row.badge === 'DLA Hai')).toEqual({
      badge: 'DLA Hai',
      price: 3,
      count: 1,
      sum: 3,
      names: ['Mira Köhler'],
    });
    expect(store.summaryOf(year - 1).every((row) => row.count === 0)).toBe(true);
    expect(store.paidIn(year).map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['r-2', 'r-3']),
    );
  });

  it('shows paid badges of other years only when that year is chosen', () => {
    const store = create();
    const mira = store.persons().find((person) => person.name === 'Mira Köhler');
    expect(store.visibleOf(mira ?? store.persons()[0])).toHaveLength(1);
    store.year.update((year) => year - 1);
    expect(store.visibleOf(mira ?? store.persons()[0])).toHaveLength(0);
  });

  it('accepts a name in any case or a member number and writes it as in the member list', () => {
    const store = create();
    const people = TestBed.inject(PeopleStore);
    const draft = { ...emptyRecord(store.today, 'DSA Bronze') };
    expect(store.saveRecord(draft, 'anna brandt')).toBe('');
    const added = store
      .records()
      .find(
        (entry) => entry.id !== '' && entry.name === 'Anna Brandt' && entry.badge === 'DSA Bronze',
      );
    expect(added?.memberNo).toBe(people.memberNoOf('Anna Brandt'));
    const number = people.memberNoOf('Mia Vogel');
    if (number) {
      expect(store.saveRecord(draft, number)).toBe('');
      expect(
        store
          .records()
          .some(
            (entry) =>
              entry.name === 'Mia Vogel' && entry.badge === 'DSA Bronze' && entry.id !== 'r-1',
          ),
      ).toBe(true);
    }
  });

  it('refuses somebody who is not a member', () => {
    const store = create();
    const problem = store.saveRecord(emptyRecord(store.today, 'DSA Bronze'), 'Niemand Unbekanntes');
    expect(problem).toContain('„Niemand Unbekanntes“ steht nicht in der Mitgliederliste');
    expect(store.nameProblem('Niemand Unbekanntes')).toBe(problem);
    expect(store.nameProblem('Mia Vogel')).toBe('');
    expect(store.records()).toHaveLength(5);
  });

  it('books a badge that is entered as paid right away', () => {
    const store = create();
    const cash = TestBed.inject(CashStore);
    const before = stockOf('DSA Gold') ?? 0;
    const draft = { ...emptyRecord(store.today, 'DSA Gold'), state: 'bezahlt' as const };
    expect(store.saveRecord(draft, 'Jonas Weber')).toBe('');
    const record = store.records().find((entry) => entry.name === 'Jonas Weber');
    expect(record).toMatchObject({ state: 'bezahlt', paidOn: store.today });
    expect(cash.entries().some((entry) => entry.ref === `abz:${record?.id}`)).toBe(true);
    expect(stockOf('DSA Gold')).toBe(before - 1);
  });

  it('adds a kind of badge once and shows it in the stock', () => {
    const store = create();
    expect(store.addKind({ name: '', price: 1, requirements: [] })).toBe(
      'Bitte einen Namen eintragen.',
    );
    expect(store.addKind({ name: 'DSA Gold', price: 1, requirements: [] })).toBe(
      'Dieses Abzeichen gibt es schon.',
    );
    expect(store.addKind({ name: 'Freischwimmer', price: 2.5, requirements: ['25 m'] })).toBe('');
    expect(store.kindOf('Freischwimmer').price).toBe(2.5);
    expect(TestBed.inject(EquipmentStore).badges().at(-1)).toEqual({
      name: 'Freischwimmer',
      stock: null,
      minimum: null,
    });
    store.saveKind({ name: 'Freischwimmer', price: 3, requirements: [] });
    expect(store.kindOf('Freischwimmer')).toMatchObject({ price: 3, requirements: [] });
  });

  it('removes a record', () => {
    const store = create();
    store.removeRecord('r-4');
    expect(store.records()).toHaveLength(4);
  });
});
