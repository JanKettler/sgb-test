import { TestBed } from '@angular/core/testing';
import { TrainingStore } from '../training/training.store';
import { CashStore } from '../youth/cash.store';
import { MarketStore } from './market.store';

type Role = 'admin' | 'trainer' | 'parent';

function create(role: Role = 'admin'): MarketStore {
  TestBed.resetTestingModule();
  TestBed.inject(TrainingStore).role.set(role);
  return TestBed.inject(MarketStore);
}

const names = (store: MarketStore, id: string) =>
  store.slots().find((slot) => slot.id === id)?.helpers ?? [];

describe('MarketStore helper lists', () => {
  it('starts with the next market weekend and a countdown that has not run out', () => {
    const store = create();
    expect(store.saturday() >= store.today).toBe(true);
    expect(['before', 'running']).toContain(store.countdown().phase);
    expect(store.dateOf('sonntag') > store.dateOf('samstag')).toBe(true);
  });

  it('puts the person who is logged in on a line, once', () => {
    const store = create('parent');
    expect(store.signUp('s-3', 'helpers')).toBe('');
    expect(names(store, 's-3')).toEqual(['Ole Brandt', 'Sabine']);
    expect(store.signUp('s-3', 'helpers')).toContain('Du stehst hier schon');
    expect(store.signUp('s-2', 'helpers')).toContain('Du stehst hier schon');
  });

  it('does not let a line overflow, and does not know lines that are gone', () => {
    const store = create();
    const line = store.slots().find((slot) => slot.id === 's-1')!;
    store.saveSlot({ ...line, maxHelpers: 2 });
    expect(store.signUp('s-1', 'helpers')).toBe('Diese Zeit ist schon voll.');
    expect(store.signUp('gibt-es-nicht', 'helpers')).toContain('nicht mehr');
  });

  it('lets only the organisers put other people on a line', () => {
    const parent = create('parent');
    expect(parent.signUp('s-5', 'helpers', 'Nora Kranz')).toBe(
      'Andere trägt nur das Orga-Team ein.',
    );
    const admin = create('admin');
    expect(admin.signUp('s-5', 'helpers', 'Nora Kranz')).toBe('');
    expect(names(admin, 's-5')).toEqual(['Nora Kranz']);
  });

  it('lets people take themselves off, and the organisers everybody', () => {
    const parent = create('parent');
    parent.signOff('s-2', 'helpers', 0);
    expect(names(parent, 's-2')).toEqual(['Nora Kranz', 'Sabine Beispiel']);
    parent.signOff('s-2', 'helpers', 1);
    expect(names(parent, 's-2')).toEqual(['Nora Kranz']);
    const admin = create('admin');
    admin.signOff('s-2', 'helpers', 0);
    expect(names(admin, 's-2')).toEqual(['Sabine Beispiel']);
  });

  it('shows the first name to everybody except the organisers and the person themselves', () => {
    const parent = create('parent');
    expect(parent.shown('Lena Muster')).toBe('Lena');
    expect(parent.shown('Sabine Beispiel')).toBe('Sabine Beispiel');
    expect(create('trainer').shown('Lena Muster')).toBe('Lena Muster');
  });

  it('lists the shifts of the person who is logged in', () => {
    const shifts = create('parent').myShifts();
    expect(shifts.map((shift) => shift.what)).toEqual([
      '14:00–16:00 · Unterstützung vor Ort',
      'Waffelteig · Platz 2',
    ]);
    expect(
      create('admin')
        .myShifts()
        .map((shift) => shift.what),
    ).toEqual(['12:00–14:00 · Aufsicht (Ü18)']);
  });

  it('moves, adds, changes and removes lines', () => {
    const store = create();
    store.moveSlot('s-2', -1);
    expect(store.slotsOf('samstag').map((slot) => slot.id)).toEqual(['s-2', 's-1', 's-3']);
    store.moveSlot('s-2', -1);
    expect(store.slotsOf('samstag')[0].id).toBe('s-2');
    expect(store.saveSlot({ ...store.newSlot('sonntag'), label: ' ' })).toContain('Zeit');
    expect(store.saveSlot({ ...store.newSlot('sonntag'), label: '17:00–18:00' })).toBe('');
    expect(store.slotsOf('sonntag')).toHaveLength(4);
    store.removeSlot('s-4');
    expect(store.slotsOf('sonntag')).toHaveLength(3);
  });

  it('hands out the places for the dough and takes them back', () => {
    const store = create('parent');
    expect(store.claimDough('t-samstag-1')).toBe('Der Platz ist schon vergeben.');
    expect(store.claimDough('t-samstag-3')).toBe('');
    expect(store.doughOf('samstag')[2].name).toBe('Sabine');
    store.releaseDough('t-samstag-1');
    expect(store.doughOf('samstag')[0].name).toBe('Frieda Lindner');
    store.releaseDough('t-samstag-3');
    expect(store.doughOf('samstag')[2].name).toBe('');
  });

  it('adds a place for the dough, and only takes a free last place away', () => {
    const store = create();
    expect(store.doughOf('sonntag')).toHaveLength(5);
    store.resizeDough('sonntag', 1);
    expect(store.doughOf('sonntag').map((spot) => spot.no)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(store.resizeDough('sonntag', -1)).toBe('');
    expect(store.doughOf('sonntag')).toHaveLength(5);
    store.claimDough('t-sonntag-5', 'Ben Sommer');
    expect(store.resizeDough('sonntag', -1)).toContain('vergeben');
    expect(store.doughOf('sonntag')).toHaveLength(5);
  });

  it('changes the date of the market', () => {
    const store = create();
    expect(store.setSaturday('morgen')).toContain('Datum');
    expect(store.setSaturday('2027-12-04')).toBe('');
    expect(store.dateOf('sonntag')).toBe('2027-12-05');
    expect(store.year()).toBe('2027');
  });
});

describe('MarketStore cash desk', () => {
  it('counts what is sold and handed out, and takes the last booking back', () => {
    const store = create();
    for (let times = 0; times < 3; times++) store.count('samstag', 'waffel', 'paid', 1);
    store.count('samstag', 'waffel', 'free', 1);
    expect(store.tally('samstag', 'waffel')).toEqual({ paid: 3, free: 1 });
    expect(store.tally('sonntag', 'waffel')).toEqual({ paid: 0, free: 0 });
    expect(store.finance().days.samstag.sales).toBe(6);
    store.undo();
    expect(store.tally('samstag', 'waffel')).toEqual({ paid: 3, free: 0 });
    store.count('samstag', 'kinderpunsch', 'paid', -1);
    expect(store.tally('samstag', 'kinderpunsch').paid).toBe(0);
    expect(store.waffles()).toBe(3);
    expect(store.batches()).toBe(1);
  });

  it('only lets the organisers use the cash desk', () => {
    const store = create('parent');
    expect(store.count('samstag', 'waffel', 'paid', 1)).toBe('Die Kasse bedient das Orga-Team.');
    expect(store.tally('samstag', 'waffel').paid).toBe(0);
    expect(store.closeDay('samstag')).toBe('Das darf nur das Orga-Team.');
  });

  it('takes no more bookings after the day is closed, and only the board opens it again', () => {
    const store = create('trainer');
    store.count('samstag', 'waffel', 'paid', 2);
    expect(store.closeDay('samstag')).toBe('');
    expect(store.isClosed('samstag')).toBe(true);
    expect(store.count('samstag', 'waffel', 'paid', 1)).toBe('Samstag ist abgeschlossen.');
    expect(store.setDonation('samstag', 5)).toBe('Samstag ist abgeschlossen.');
    expect(store.saveCount('samstag', 'evening', { '5': 1 })).toBe('Samstag ist abgeschlossen.');
    expect(store.count('sonntag', 'waffel', 'paid', 1)).toBe('');
    expect(store.reopenDay('samstag')).toBe('Nur der Vorstand kann einen Tag wieder öffnen.');
    TestBed.inject(TrainingStore).role.set('admin');
    expect(store.reopenDay('samstag')).toBe('');
    expect(store.count('samstag', 'waffel', 'paid', 1)).toBe('');
    expect(store.tally('samstag', 'waffel').paid).toBe(3);
  });

  it('records the donation and the fee', () => {
    const store = create();
    expect(store.setDonation('samstag', -1)).toContain('negativ');
    expect(store.setDonation('samstag', 12.5)).toBe('');
    expect(store.finance().days.samstag.donation).toBe(12.5);
    expect(store.setFee(-5)).toContain('negativ');
    expect(store.setFee(60)).toBe('');
    expect(store.finance().fee).toBe(60);
  });

  it('compares the cash count with the sales of the day', () => {
    const store = create();
    store.count('samstag', 'waffel', 'paid', 20);
    store.setDonation('samstag', 5);
    store.saveCount('samstag', 'start', { '10': 2 });
    expect(store.addWithdrawal('samstag', 0, 'Wechselgeld')).toContain('größer als 0');
    expect(store.addWithdrawal('samstag', 10, ' ')).toContain('Grund');
    expect(store.addWithdrawal('samstag', 10, 'Wechselgeld geholt')).toBe('');
    expect(store.resultOf('samstag').expected).toBe(55);
    expect(store.resultOf('samstag').done).toBe(false);
    store.saveCount('samstag', 'evening', { '50': 1, '5': 1 });
    expect(store.resultOf('samstag')).toMatchObject({ counted: 55, difference: 0, done: true });
    store.removeWithdrawal('samstag', store.sturzOf('samstag').withdrawals[0].id);
    expect(store.resultOf('samstag').difference).toBe(-10);
  });

  it('keeps the expenses and subtracts them from the profit', () => {
    const store = create();
    const before = store.finance().expenses;
    expect(
      store.saveExpense({ id: '', date: '2026-11-20', text: ' ', amount: 5, receipt: false }),
    ).toContain('Verwendungszweck');
    expect(
      store.saveExpense({
        id: '',
        date: '2026-11-20',
        text: 'Servietten',
        amount: 0,
        receipt: false,
      }),
    ).toContain('größer als 0');
    expect(
      store.saveExpense({
        id: '',
        date: '2026-11-20',
        text: 'Servietten',
        amount: 4.5,
        receipt: true,
      }),
    ).toBe('');
    expect(store.finance().expenses).toBe(Math.round((before + 4.5) * 100) / 100);
    const added = store.expenses().at(-1)!;
    store.saveExpense({ ...added, amount: 6 });
    expect(store.expenses().at(-1)!.amount).toBe(6);
    store.removeExpense(added.id);
    expect(store.finance().expenses).toBe(before);
  });

  it('adds products of its own and keeps the two of the market', () => {
    const store = create();
    expect(
      store.saveProduct({ ...store.products()[0], id: '', name: ' ', builtin: false }),
    ).toContain('Namen');
    expect(
      store.saveProduct({
        ...store.products()[0],
        id: '',
        name: 'Bratwurst',
        price: 3.5,
        builtin: false,
      }),
    ).toBe('');
    const added = store.products().at(-1)!;
    expect(added.builtin).toBe(false);
    store.count('sonntag', added.id, 'paid', 4);
    expect(store.finance().days.sonntag.sales).toBe(14);
    store.removeProduct(added.id);
    store.removeProduct('waffel');
    expect(store.products().map((product) => product.id)).toEqual(['waffel', 'kinderpunsch']);
  });

  it('books the profit once as income of the youth cash', () => {
    const store = create();
    const cash = TestBed.inject(CashStore);
    expect(store.bookProfit()).toBe('Es gibt keinen Gewinn zu buchen.');
    store.count('samstag', 'waffel', 'paid', 100);
    const profit = store.finance().profit;
    expect(profit).toBe(123.6);
    expect(store.bookProfit()).toBe('');
    const entry = cash.entries().find((item) => item.ref === store.bookingRef());
    expect(entry).toMatchObject({ kind: 'in', amount: 123.6, category: 'Veranstaltung' });
    expect(entry?.text).toContain('Weihnachtsmarkt');
    expect(store.booked()?.id).toBe(entry?.id);
    expect(store.bookProfit()).toBe('Der Gewinn ist schon in der Jugendkasse gebucht.');
    expect(cash.entries().filter((item) => item.ref === store.bookingRef())).toHaveLength(1);
  });
});

describe('MarketStore stock and recipe', () => {
  it('adds, changes and removes articles, and checks the entries', () => {
    const store = create();
    const count = store.stock().length;
    expect(store.saveItem({ ...store.newItem(), name: ' ' })).toContain('Namen');
    expect(store.saveItem({ ...store.newItem(), name: 'Salz', need: -1 })).toContain('negativ');
    expect(store.saveItem({ ...store.newItem(), name: 'Salz', need: 1, unit: 'kg' })).toBe('');
    expect(store.stock()).toHaveLength(count + 1);
    const salt = store.stock().at(-1)!;
    store.saveItem({ ...salt, need: 2 });
    expect(store.stock().at(-1)!.need).toBe(2);
    store.removeItem(salt.id);
    expect(store.stock()).toHaveLength(count);
  });

  it('ticks an article as bought and keeps the packs that were missing', () => {
    const store = create();
    const before = store.totals();
    store.toggleBought('i-1');
    const flour = store.stock().find((item) => item.id === 'i-1')!;
    expect(flour).toMatchObject({ bought: true, boughtPacks: 10 });
    expect(store.totals().done).toBeGreaterThan(0);
    expect(store.totals().open).toBeLessThan(before.open);
    store.setStock('i-1', 12);
    expect(store.totals().done).toBeGreaterThan(0);
    store.toggleBought('i-1');
    expect(store.stock().find((item) => item.id === 'i-1')).toMatchObject({
      bought: false,
      boughtPacks: 0,
    });
  });

  it('puts an article on the shopping list or takes it off', () => {
    const store = create();
    const count = store.shopping().length;
    store.toggleOnList('i-15');
    expect(store.shopping()).toHaveLength(count + 1);
    store.toggleOnList('i-1');
    expect(store.shopping()).toHaveLength(count);
    store.setStock('i-1', -3);
    expect(store.stock().find((item) => item.id === 'i-1')!.stock).toBe(2);
  });

  it('offers the categories and shops that are in use', () => {
    const store = create();
    store.saveItem({ ...store.newItem('Deko'), name: 'Lichterkette', store: 'Baumarkt' });
    expect(store.categories()).toContain('Deko');
    expect(store.shops()).toContain('Baumarkt');
    expect(store.shops()).toContain('REWE');
  });

  it('shows what the recipe changes in the shopping list and takes it over', () => {
    const store = create();
    const plan = store.transferPlan(16);
    expect(plan.map((line) => line.name)).not.toContain('Wasser');
    expect(plan.find((line) => line.name === 'Wintertee')).toMatchObject({
      amount: 20,
      known: true,
      before: '10 Btl.',
    });
    expect(store.applyRecipe(16)).toBe(plan.length);
    expect(store.stock().find((item) => item.name === 'Wintertee')!.need).toBe(20);
    expect(store.stock().find((item) => item.name === 'Zimtstangen')!.need).toBe(4);
  });

  it('adds an ingredient that is not in the stock yet', () => {
    const store = create();
    store.removeItem('i-12');
    expect(store.transferPlan(8).find((line) => line.name === 'Glühfix')?.known).toBe(false);
    store.applyRecipe(8);
    const added = store.stock().find((item) => item.name === 'Glühfix')!;
    expect(added).toMatchObject({ need: 5, unit: 'Btl.', category: 'Zutaten' });
    expect(store.stock().filter((item) => item.name === 'Glühfix')).toHaveLength(1);
  });

  it('keeps the text of the recipe', () => {
    const store = create();
    store.saveRecipe({ steps: ' Kochen. ', note: '' });
    expect(store.recipe().steps).toBe('Kochen.');
    expect(store.recipe().ingredients).toHaveLength(7);
  });
});

describe('MarketStore setting up and taking down', () => {
  it('ticks steps and keeps the order of each part', () => {
    const store = create();
    store.toggleStep('a-1');
    expect(store.stepsOf('aufbau')[0].done).toBe(true);
    store.toggleStep('a-1');
    expect(store.stepsOf('aufbau')[0].done).toBe(false);
    store.moveStep('a-2', -1);
    expect(
      store
        .stepsOf('aufbau')
        .map((step) => step.id)
        .slice(0, 2),
    ).toEqual(['a-2', 'a-1']);
    store.moveStep('a-2', -1);
    expect(store.stepsOf('aufbau')[0].id).toBe('a-2');
  });

  it('adds, changes and removes steps', () => {
    const store = create();
    expect(store.saveStep({ ...store.newStep('abbau'), title: ' ' })).toContain('beschreiben');
    expect(
      store.saveStep({ ...store.newStep('abbau'), title: 'Müll rausbringen', time: '18:30' }),
    ).toBe('');
    const added = store.stepsOf('abbau')[0];
    expect(added).toMatchObject({ title: 'Müll rausbringen', time: '18:30', phase: 'abbau' });
    store.saveStep({ ...added, title: 'Müll wegbringen' });
    expect(store.stepsOf('abbau')[0].title).toBe('Müll wegbringen');
    store.removeStep(added.id);
    expect(store.stepsOf('abbau')).toHaveLength(0);
  });

  it('suggests the usual steps for taking down, but only for an empty list', () => {
    const store = create();
    store.addStandardAbbau();
    expect(store.stepsOf('abbau')).toHaveLength(6);
    expect(store.stepsOf('abbau')[0].title).toContain('Kasse');
    store.addStandardAbbau();
    expect(store.stepsOf('abbau')).toHaveLength(6);
    expect(store.stepsOf('aufbau')).toHaveLength(5);
  });

  it('keeps the notes', () => {
    const store = create();
    expect(store.saveNote({ ...store.newNote(), title: ' ' })).toContain('Überschrift');
    expect(store.saveNote({ ...store.newNote(), title: 'Wasser', text: 'Kanister füllen' })).toBe(
      '',
    );
    const added = store.notes().at(-1)!;
    store.saveNote({ ...added, text: 'Zwei Kanister füllen' });
    expect(store.notes().at(-1)!.text).toBe('Zwei Kanister füllen');
    store.removeNote(added.id);
    expect(store.notes()).toHaveLength(2);
  });
});
