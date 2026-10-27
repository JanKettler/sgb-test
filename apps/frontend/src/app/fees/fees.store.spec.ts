import { TestBed } from '@angular/core/testing';
import { FeesStore } from './fees.store';

describe('FeesStore', () => {
  it('creates yearly payments with some open ones', () => {
    const store = TestBed.inject(FeesStore);
    expect(store.payments().length).toBeGreaterThan(10);
    expect(store.open().length).toBeGreaterThan(0);
    expect(store.openTotal()).toBeGreaterThan(0);
  });

  it('charges the reminder fee from level 2 on', () => {
    const store = TestBed.inject(FeesStore);
    const rows = store.dunningRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.fee).toBe(row.level >= 2 ? 5 : 0);
      expect(row.total).toBe(row.payment.amount + row.fee);
    }
  });

  it('raises the level when a reminder is sent', () => {
    const store = TestBed.inject(FeesStore);
    const row = store.dunningRows()[0];
    store.sendDunning(new Set([row.payment.id]));
    const after = store.payments().find((item) => item.id === row.payment.id);
    expect(after?.dunning).toBe(row.level);
  });

  it('books and removes payments', () => {
    const store = TestBed.inject(FeesStore);
    const open = store.open()[0];
    store.book(new Set([open.id]));
    expect(store.payments().find((item) => item.id === open.id)?.paid).toBe(true);
    store.remove(new Set([open.id]));
    expect(store.payments().some((item) => item.id === open.id)).toBe(false);
  });

  it('fills the purpose from the template', () => {
    const store = TestBed.inject(FeesStore);
    const purpose = store.purposeOf(store.payments()[0]);
    expect(purpose).toContain(String(store.year));
    expect(purpose).not.toContain('[');
  });
});
