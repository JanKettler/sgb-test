import { TestBed } from '@angular/core/testing';
import { PeopleStore } from './people.store';

describe('PeopleStore', () => {
  it('derives members and parents from the invented demo people', () => {
    const store = TestBed.inject(PeopleStore);
    expect(store.members().length).toBeGreaterThan(20);
    expect(store.parents().length).toBeGreaterThan(5);
    const lena = store.member('p-lena');
    expect(lena).toBeDefined();
    // Siblings share their parents.
    expect(
      store
        .siblingsOf(lena!)
        .map((member) => member.firstName)
        .sort(),
    ).toEqual(['Ben', 'Mats']);
  });

  it('lists only what is missing or running out', () => {
    const store = TestBed.inject(PeopleStore);
    expect(store.dueEvidence().length).toBeGreaterThan(0);
    expect(store.dueEvidence().every((row) => row.missing || (row.days ?? 0) <= 90)).toBe(true);
  });

  it('keeps a new person after saving', () => {
    const store = TestBed.inject(PeopleStore);
    const before = store.members().length;
    store.save({ ...store.newMember(), firstName: 'Test', lastName: 'Person' });
    expect(store.members()).toHaveLength(before + 1);
  });

  it('exports a csv with a BOM', () => {
    const store = TestBed.inject(PeopleStore);
    expect(store.membersCsv(store.members()).startsWith('﻿Mitgliedsnummer;Name')).toBe(true);
  });

  it('links a saved parent to exactly the chosen children', () => {
    const store = TestBed.inject(PeopleStore);
    const [first, second] = store.members();
    const parent = store.newParent();
    parent.name = 'Test Elternteil';
    store.saveParent(parent, [first.id]);
    expect(store.childrenOf(parent).map((child) => child.id)).toEqual([first.id]);
    store.saveParent(parent, [second.id]);
    expect(store.childrenOf(parent).map((child) => child.id)).toEqual([second.id]);
  });

  it('removes a deleted parent from the children', () => {
    const store = TestBed.inject(PeopleStore);
    const parent = store.parents()[0];
    store.deleteParent(parent.id);
    expect(store.parents().some((item) => item.id === parent.id)).toBe(false);
    expect(store.members().some((member) => member.parentIds.includes(parent.id))).toBe(false);
  });

  it('deletes a member', () => {
    const store = TestBed.inject(PeopleStore);
    const member = store.members()[0];
    store.deleteMember(member.id);
    expect(store.member(member.id)).toBeUndefined();
  });
});
