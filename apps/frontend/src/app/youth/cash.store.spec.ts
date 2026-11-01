import { TestBed } from '@angular/core/testing';
import { addMonthKey, monthKey } from '../training/training-dates';
import { TrainingStore } from '../training/training.store';
import { emptyEntry, piecesText, roundCents } from './cash.models';
import { CashStore } from './cash.store';

describe('CashStore', () => {
  function create() {
    TestBed.resetTestingModule();
    return TestBed.inject(CashStore);
  }

  const thisMonth = (store: CashStore) => monthKey(store.today);
  const lastMonth = (store: CashStore) => addMonthKey(thisMonth(store), -1);

  it('counts the confirmed bookings into the balance and the open ones separately', () => {
    const store = create();
    expect(store.balance()).toBe(155.5);
    expect(store.balanceWithOpen()).toBe(139.6);
    expect(store.openEntries()).toHaveLength(2);
    expect(store.requestedExpenses()).toHaveLength(1);
  });

  it('knows the balance at the end of a month', () => {
    const store = create();
    expect(store.balanceUpTo(true, `${lastMonth(store)}-31`)).toBe(155.5);
    expect(store.balanceUpTo(true, `${lastMonth(store)}-06`)).toBe(180);
  });

  it('starts every booking open and refuses an empty amount', () => {
    const store = create();
    const entry = { ...emptyEntry('in', store.today, 'Material'), text: 'Spende', amount: 10 };
    expect(store.saveEntry(entry)).toBe('');
    const saved = store.entries().find((item) => item.text === 'Spende');
    expect(saved).toMatchObject({ status: 'open', from: 'Maria', confirmedBy: '' });
    expect(store.saveEntry({ ...entry, amount: 0 })).toBe('Der Betrag muss größer als 0 sein.');
  });

  it('confirms and unconfirms a booking and remembers who did it', () => {
    const store = create();
    store.setEntryStatus('k-4', 'confirmed');
    expect(store.entries().find((item) => item.id === 'k-4')).toMatchObject({
      status: 'confirmed',
      confirmedBy: 'Maria',
    });
    expect(store.balance()).toBe(136.6);
    store.setEntryStatus('k-4', 'open');
    expect(store.entries().find((item) => item.id === 'k-4')?.confirmedBy).toBe('');
  });

  it('locks a closed month: no new, changed, removed or confirmed bookings', () => {
    const store = create();
    store.setEntryStatus('k-3', 'confirmed');
    store.setEntryStatus('k-4', 'confirmed');
    expect(store.closeMonth(thisMonth(store))).toBe(true);
    expect(store.isClosed(store.today)).toBe(true);
    const entry = emptyEntry('out', store.today, 'Material');
    expect(store.saveEntry({ ...entry, amount: 5 })).toBe('Dieser Monat ist abgeschlossen.');
    store.removeEntry('k-3');
    store.setEntryStatus('k-3', 'open');
    expect(store.entries().find((item) => item.id === 'k-3')?.status).toBe('confirmed');
    expect(store.entries().some((item) => item.id === 'k-3')).toBe(true);
    store.reopenMonth(thisMonth(store));
    expect(store.isClosed(store.today)).toBe(false);
  });

  it('closes a month only when every booking in it is confirmed', () => {
    const store = create();
    expect(store.closeMonth(thisMonth(store))).toBe(false);
    expect(store.closeMonth(lastMonth(store))).toBe(true);
    expect(store.closingOf(lastMonth(store))).toMatchObject({ balance: 155.5, by: 'Maria' });
    expect(store.closeMonth(lastMonth(store))).toBe(false);
  });

  it('refunds an approved expense as a confirmed booking of the cash', () => {
    const store = create();
    expect(store.setExpenseState('l-1', 'approved')).toBe('');
    expect(store.expenses()[0]).toMatchObject({ state: 'approved', handledBy: 'Maria' });
    expect(store.setExpenseState('l-1', 'refunded')).toBe('');
    const booked = store.entries().find((item) => item.ref === 'l-1');
    expect(booked).toMatchObject({ kind: 'out', amount: 12.4, status: 'confirmed' });
    expect(booked?.text).toContain('Pokale für den Vereinsvergleich');
    expect(store.balance()).toBe(143.1);
  });

  it('keeps an expense unpaid when the month of the refund is closed', () => {
    const store = create();
    store.setEntryStatus('k-3', 'confirmed');
    store.setEntryStatus('k-4', 'confirmed');
    store.closeMonth(thisMonth(store));
    expect(store.setExpenseState('l-1', 'refunded')).toBe('Dieser Monat ist abgeschlossen.');
    expect(store.expenses()[0].state).toBe('requested');
  });

  it('requests and removes an expense', () => {
    const store = create();
    expect(store.requestExpense({ amount: 0, date: store.today, text: 'x', receipt: '' })).toBe(
      'Der Betrag muss größer als 0 sein.',
    );
    expect(store.requestExpense({ amount: 5, date: store.today, text: 'Folie', receipt: '' })).toBe(
      '',
    );
    expect(store.expenses()).toHaveLength(2);
    store.removeExpense('l-1');
    expect(store.expenses().map((item) => item.text)).toEqual(['Folie']);
  });

  it('compares a cash count with the book', () => {
    const store = create();
    const count = store.saveCount({
      date: store.today,
      counted: 150,
      pieces: { '100': 1, '50': 1 },
      note: '',
    });
    expect(count).toMatchObject({ expected: 155.5, difference: -5.5, by: 'Maria' });
    expect(store.lastCount()?.id).toBe(count.id);
    expect(piecesText(count.pieces)).toBe('1× 100 € · 1× 50 €');
  });

  it('writes the cash book of a year with a running balance', () => {
    const store = create();
    const year = Number(store.today.slice(0, 4));
    const book = store.bookOf(year);
    expect(book.rows.every((row) => row.date.startsWith(String(year)))).toBe(true);
    expect(book.rows.at(-1)?.balance ?? book.start).toBe(155.5);
    const next = store.bookOf(year + 1);
    expect(next.start).toBe(155.5);
    expect(next.rows).toHaveLength(0);
  });

  it('saves the settings and falls back to the usual categories', () => {
    const store = create();
    expect(store.categories()).toContain('Verpflegung');
    store.saveConfig({ ...store.config(), categories: [] });
    expect(store.categories()).toContain('Verpflegung');
    store.saveConfig({ ...store.config(), categories: ['Nur eine'] });
    expect(store.categories()).toEqual(['Nur eine']);
  });

  it('lets only the board confirm, close and change the settings', () => {
    const store = create();
    expect(store.canConfirm()).toBe(true);
    TestBed.inject(TrainingStore).role.set('trainer');
    expect(store.canBook()).toBe(true);
    expect(store.canConfirm()).toBe(false);
    expect(store.canAdminister()).toBe(false);
    expect(roundCents(0.1 + 0.2)).toBe(0.3);
  });
});
