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
});
