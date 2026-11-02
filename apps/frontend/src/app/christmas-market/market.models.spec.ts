import { euro } from '../core/money';
import {
  Counts,
  Product,
  Recipe,
  Slot,
  StockItem,
  Sturz,
  buyOf,
  countdownOf,
  countdownText,
  dayDate,
  financeOf,
  findStockItem,
  marketSaturday,
  numberText,
  onShoppingList,
  piecesSum,
  quantity,
  sameName,
  scaleRecipe,
  shoppingTotals,
  shownName,
  slotFull,
  sturzResult,
  sturzVerdict,
} from './market.models';
import { sampleProducts, sampleRecipe, sampleStock } from './market.sample';

function item(data: Partial<StockItem>): StockItem {
  return {
    id: 'x',
    category: 'Zutaten',
    name: 'Mehl',
    box: '',
    status: 'Offen',
    need: 0,
    unit: 'kg',
    stock: 0,
    pack: 0,
    price: 0,
    store: '',
    onList: null,
    bought: false,
    boughtPacks: 0,
    ...data,
  };
}

describe('market dates', () => {
  it('takes the first Saturday on or after 28 November', () => {
    expect(marketSaturday('2026-11-02')).toBe('2026-11-28');
    expect(marketSaturday('2026-11-28')).toBe('2026-11-28');
    expect(marketSaturday('2026-11-29')).toBe('2026-11-28');
    expect(marketSaturday('2027-01-10')).toBe('2027-12-04');
    expect(marketSaturday('2028-03-01')).toBe('2028-12-02');
  });

  it('puts Sunday one day after Saturday', () => {
    expect(dayDate('2026-11-28', 'samstag')).toBe('2026-11-28');
    expect(dayDate('2026-11-28', 'sonntag')).toBe('2026-11-29');
  });

  it('counts the days down and knows when the market runs or is over', () => {
    expect(countdownOf('2026-11-02', '2026-11-28')).toEqual({ phase: 'before', days: 26 });
    expect(countdownText(countdownOf('2026-11-02', '2026-11-28'))).toBe(
      'Noch 26 Tage bis zum Weihnachtsmarkt.',
    );
    expect(countdownText(countdownOf('2026-11-27', '2026-11-28'))).toBe('Morgen geht es los.');
    expect(countdownOf('2026-11-28', '2026-11-28').phase).toBe('running');
    expect(countdownOf('2026-11-29', '2026-11-28').phase).toBe('running');
    expect(countdownText(countdownOf('2026-11-29', '2026-11-28'))).toBe(
      'Der Weihnachtsmarkt läuft gerade.',
    );
    expect(countdownOf('2026-11-30', '2026-11-28').phase).toBe('over');
  });
});

describe('helper lists', () => {
  const slot: Slot = {
    id: 's',
    day: 'samstag',
    label: '12:00–14:00',
    helpers: ['Lena Muster', 'Tim Probst'],
    maxHelpers: 2,
    supervisors: [],
    maxSupervisors: 0,
    note: '',
  };

  it('knows when a line is full, and that no limit is never full', () => {
    expect(slotFull(slot, 'helpers')).toBe(true);
    expect(slotFull({ ...slot, maxHelpers: 3 }, 'helpers')).toBe(false);
    expect(slotFull({ ...slot, supervisors: ['A', 'B', 'C'] }, 'supervisors')).toBe(false);
  });

  it('matches a first name with the full name, and shows first names to the others', () => {
    expect(sameName('Maria Beispiel', 'Maria')).toBe(true);
    expect(sameName('maria', 'Maria Beispiel')).toBe(true);
    expect(sameName('Maria Beispiel', 'Maria Muster')).toBe(false);
    expect(sameName('Maria', 'Marie')).toBe(false);
    expect(shownName('Lena Muster', true)).toBe('Lena Muster');
    expect(shownName('Lena Muster', false)).toBe('Lena');
  });
});

describe('cash desk', () => {
  const products: Product[] = sampleProducts();
  const counts: Counts = {
    'samstag|waffel': { paid: 30, free: 4 },
    'samstag|kinderpunsch': { paid: 20, free: 2 },
    'sonntag|waffel': { paid: 10, free: 0 },
  };

  it('adds up the paid products and the donations, not the free ones', () => {
    const finance = financeOf(products, counts, { samstag: 7.5, sonntag: 0 }, 45, [
      { id: 'e-1', date: '', text: 'Plakate', amount: 12.5, receipt: true },
      { id: 'e-2', date: '', text: 'Ersatzteil', amount: 18.9, receipt: false },
    ]);
    expect(finance.days.samstag).toEqual({ sales: 100, donation: 7.5, total: 107.5 });
    expect(finance.days.sonntag).toEqual({ sales: 20, donation: 0, total: 20 });
    expect(finance.revenue).toBe(127.5);
    expect(finance.expenses).toBe(31.4);
    expect(finance.profit).toBe(51.1);
  });

  it('works out a loss as a negative profit', () => {
    const finance = financeOf(products, {}, { samstag: 0, sonntag: 0 }, 45, []);
    expect(finance.profit).toBe(-45);
  });

  it('adds up notes and coins', () => {
    expect(piecesSum({})).toBe(0);
    expect(piecesSum({ '50': 1, '5': 3, '0.5': 4 })).toBe(67);
    expect(piecesSum({ '0.01': 3, '0.05': 2 })).toBe(0.13);
  });

  it('compares the cash of the evening with what should be in the box', () => {
    const sturz: Sturz = {
      start: { '10': 1, '1': 5, '0.5': 10 },
      evening: { '100': 1, '5': 1, '2': 1, '0.5': 1 },
      withdrawals: [{ id: 'w', amount: 20, reason: 'Wechselgeld geholt' }],
    };
    const result = sturzResult(sturz, 100, 7.5);
    expect(result.start).toBe(20);
    expect(result.expected).toBe(107.5);
    expect(result.counted).toBe(107.5);
    expect(result.difference).toBe(0);
    expect(sturzVerdict(result, euro)).toEqual({
      tone: 'ok',
      text: 'Die Kasse stimmt auf den Cent.',
    });
  });

  it('names a small gap, a large gap and a surplus', () => {
    const base: Sturz = { start: { '10': 2 }, evening: {}, withdrawals: [] };
    const large = sturzResult({ ...base, evening: { '10': 1, '5': 1, '1': 1 } }, 0, 0);
    expect(large.difference).toBe(-4);
    expect(sturzVerdict(large, euro)).toEqual({ tone: 'bad', text: 'Es fehlen 4,00 €.' });
    const small = sturzResult({ ...base, evening: { '10': 1, '5': 1, '2': 2 } }, 0, 0);
    expect(small.difference).toBe(-1);
    expect(sturzVerdict(small, euro)).toEqual({ tone: 'warn', text: 'Es fehlen 1,00 €.' });
    const surplus = sturzResult({ ...base, evening: { '20': 1, '1': 1 } }, 0, 0);
    expect(sturzVerdict(surplus, euro)).toEqual({
      tone: 'warn',
      text: 'Es sind 1,00 € zu viel in der Kasse.',
    });
  });

  it('waits for the evening count before it names a difference', () => {
    const result = sturzResult({ start: { '10': 1 }, evening: {}, withdrawals: [] }, 50, 0);
    expect(result.done).toBe(false);
    expect(sturzVerdict(result, euro).tone).toBe('none');
  });
});

describe('shopping list', () => {
  it('works out the missing amount and the packs to buy', () => {
    const flour = item({ need: 12, stock: 2, pack: 1, price: 1.29 });
    expect(buyOf(flour)).toEqual({
      missing: 10,
      packs: 10,
      shownPacks: 10,
      total: 12.9,
      done: false,
    });
    const butter = item({ name: 'Butter', need: 8, pack: 0.25, price: 2.19 });
    expect(buyOf(butter).packs).toBe(32);
    expect(buyOf(butter).total).toBe(70.08);
  });

  it('buys by the unit without a pack size, and nothing when the stock is enough', () => {
    const milk = item({ need: 12, unit: 'l', stock: 4, price: 1.09 });
    expect(buyOf(milk).packs).toBe(8);
    expect(buyOf(milk).total).toBe(8.72);
    expect(buyOf(item({ need: 3, stock: 5, pack: 1, price: 2 })).total).toBe(0);
  });

  it('keeps the packs that were bought for the price', () => {
    const bought = item({
      need: 12,
      stock: 2,
      pack: 1,
      price: 1.29,
      bought: true,
      boughtPacks: 11,
    });
    expect(buyOf(bought).shownPacks).toBe(11);
    expect(buyOf(bought).total).toBe(14.19);
    expect(buyOf(bought).done).toBe(true);
  });

  it('puts ingredients on the list by their category, and honours a choice by hand', () => {
    expect(onShoppingList(item({ category: 'Zutaten' }))).toBe(true);
    expect(onShoppingList(item({ category: 'Technik' }))).toBe(false);
    expect(onShoppingList(item({ category: 'Technik', onList: true }))).toBe(true);
    expect(onShoppingList(item({ category: 'Zutaten', onList: false }))).toBe(false);
  });

  it('adds up what is open, what is done and what is still missing', () => {
    const totals = shoppingTotals([
      item({ id: '1', need: 10, stock: 0, pack: 1, price: 1 }),
      item({ id: '2', need: 4, stock: 4, pack: 1, price: 5 }),
      item({ id: '3', need: 6, stock: 0, pack: 3, price: 4, bought: true, boughtPacks: 2 }),
      item({ id: '4', category: 'Technik', need: 9, price: 9 }),
    ]);
    expect(totals).toEqual({ articles: 3, missing: 1, open: 10, done: 8, total: 18 });
  });

  it('writes numbers and amounts the German way', () => {
    expect(numberText(22.5)).toBe('22,5');
    expect(numberText(1234)).toBe('1.234');
    expect(quantity(12, 'Kartons')).toBe('12 Kartons');
    expect(quantity(3, '')).toBe('3');
  });

  it('has a sample stock that has something missing and something complete', () => {
    const totals = shoppingTotals(sampleStock());
    expect(totals.articles).toBeGreaterThan(8);
    expect(totals.missing).toBeGreaterThan(0);
    expect(totals.total).toBeGreaterThan(0);
  });
});

describe('recipe', () => {
  const recipe: Recipe = sampleRecipe();
  const amounts = (liters: number) =>
    Object.fromEntries(scaleRecipe(recipe, liters).map((entry) => [entry.name, entry.amount]));

  it('keeps the amounts for the base volume', () => {
    expect(amounts(8)).toEqual({
      Wasser: 2,
      Wintertee: 10,
      Orangensaft: 1,
      Apfelsaft: 2.5,
      'Roter Traubensaft': 2.5,
      Zimtstangen: 2,
      Glühfix: 5,
    });
  });

  it('scales the amounts and rounds pieces up and bags to halves', () => {
    expect(amounts(12)).toMatchObject({ Wintertee: 15, Orangensaft: 1.5, Zimtstangen: 3 });
    expect(amounts(10)).toMatchObject({ Zimtstangen: 3, Wintertee: 12.5, Glühfix: 6.5 });
    expect(amounts(4)).toMatchObject({ Wasser: 1, Apfelsaft: 1.25, Glühfix: 2.5 });
  });

  it('does not buy water', () => {
    const water = scaleRecipe(recipe, 8).find((entry) => entry.name === 'Wasser');
    expect(water?.buy).toBe(false);
  });

  it('finds the article of an ingredient, ignoring brackets and preferring the shopping category', () => {
    const items = [
      item({ id: 'a', category: 'Technik', name: 'Wintertee' }),
      item({ id: 'b', category: 'Zutaten', name: 'Wintertee (Beutel)' }),
    ];
    expect(findStockItem(items, 'wintertee')?.id).toBe('b');
    expect(findStockItem(items, 'Glühfix')).toBeUndefined();
  });
});
