import { roundCents } from '../core/money';
import { firstName, sameOwner } from '../core/names';
import { addDays, daysBetween, weekdayIndex } from '../training/training-dates';
import { DENOMINATIONS } from '../youth/cash.models';
import { IconName } from '../ui/icon';

// ---- Days and countdown ---------------------------------------------------------------------

export const MARKET_DAYS = ['samstag', 'sonntag'] as const;
export type MarketDay = (typeof MARKET_DAYS)[number];

export const DAY_NAME: Readonly<Record<MarketDay, string>> = {
  samstag: 'Samstag',
  sonntag: 'Sonntag',
};

/** Saturday of the market: the first one on or after 28 November, after that weekend the next year's. */
export function marketSaturday(today: string): string {
  const firstOn = (year: number) => {
    const base = `${year}-11-28`;
    return addDays(base, (6 - weekdayIndex(base) + 7) % 7);
  };
  const year = Number(today.slice(0, 4));
  const saturday = firstOn(year);
  return today > addDays(saturday, 1) ? firstOn(year + 1) : saturday;
}

export function dayDate(saturday: string, day: MarketDay): string {
  return day === 'samstag' ? saturday : addDays(saturday, 1);
}

export interface Countdown {
  phase: 'before' | 'running' | 'over';
  /** Days until Saturday; 0 on the days of the market. */
  days: number;
}

export function countdownOf(today: string, saturday: string): Countdown {
  const days = daysBetween(today, saturday);
  if (days > 0) return { phase: 'before', days };
  return today <= addDays(saturday, 1) ? { phase: 'running', days: 0 } : { phase: 'over', days: 0 };
}

export function countdownText(countdown: Countdown): string {
  if (countdown.phase === 'running') return 'Der Weihnachtsmarkt läuft gerade.';
  if (countdown.phase === 'over') return 'Der Weihnachtsmarkt ist vorbei.';
  if (countdown.days === 1) return 'Morgen geht es los.';
  return `Noch ${countdown.days} Tage bis zum Weihnachtsmarkt.`;
}

// ---- Helper lists (Aushang) -------------------------------------------------------------------

/** One line of the helper list: a time with the people who help and who supervise. */
export interface Slot {
  id: string;
  day: MarketDay;
  /** "12:00–14:00" */
  label: string;
  helpers: string[];
  /** 0 means no limit. */
  maxHelpers: number;
  supervisors: string[];
  maxSupervisors: number;
  note: string;
}

export const SLOT_FIELDS = ['helpers', 'supervisors'] as const;
export type SlotField = (typeof SLOT_FIELDS)[number];

export const FIELD_NAME: Readonly<Record<SlotField, string>> = {
  helpers: 'Unterstützung vor Ort',
  supervisors: 'Aufsicht (Ü18)',
};

/** A place for somebody who bakes the waffle dough at home. */
export interface DoughSpot {
  id: string;
  day: MarketDay;
  no: number;
  name: string;
}

export function slotMax(slot: Slot, field: SlotField): number {
  return field === 'helpers' ? slot.maxHelpers : slot.maxSupervisors;
}

export function slotFull(slot: Slot, field: SlotField): boolean {
  const max = slotMax(slot, field);
  return max > 0 && slot[field].length >= max;
}

/** The same person: equal names, or a first name against the full name that starts with it. */
export function sameName(left: string, right: string): boolean {
  return sameOwner(left, right) || sameOwner(right, left);
}

/** The name as shown: organisers and the people themselves see it as written, the others the first name. */
export function shownName(name: string, full: boolean): string {
  return full ? name : firstName(name);
}

// ---- Cash desk (Kasse) ---------------------------------------------------------------------

export const PRODUCT_TONES = ['warning', 'danger', 'success', 'info', 'link', 'primary'] as const;
export type ProductTone = (typeof PRODUCT_TONES)[number];

export interface Product {
  id: string;
  name: string;
  /** "Stück" or "Becher" */
  unit: string;
  price: number;
  tone: ProductTone;
  icon: IconName;
  /** The two products of the market cannot be removed. */
  builtin: boolean;
}

/** Sold and handed out for free (to the helpers) of one product on one day. */
export interface Tally {
  paid: number;
  free: number;
}

export type TallyType = keyof Tally;
export const TALLY_TYPES: readonly TallyType[] = ['paid', 'free'];

/** Counts by "day|product". */
export type Counts = Readonly<Record<string, Tally>>;

export function tallyKey(day: MarketDay, productId: string): string {
  return `${day}|${productId}`;
}

export function tallyOf(counts: Counts, day: MarketDay, productId: string): Tally {
  return counts[tallyKey(day, productId)] ?? { paid: 0, free: 0 };
}

export interface MarketExpense {
  id: string;
  /** ISO date */
  date: string;
  text: string;
  amount: number;
  /** A receipt is available. */
  receipt: boolean;
}

export interface Closing {
  /** ISO date */
  at: string;
  by: string;
}

export interface DayFinance {
  sales: number;
  donation: number;
  total: number;
}

export interface Finance {
  days: Record<MarketDay, DayFinance>;
  revenue: number;
  fee: number;
  expenses: number;
  profit: number;
}

/** Money taken in at the stand: the paid products and the donations; the free ones do not count. */
export function financeOf(
  products: readonly Product[],
  counts: Counts,
  donations: Readonly<Record<MarketDay, number>>,
  fee: number,
  expenses: readonly MarketExpense[],
): Finance {
  const dayOf = (day: MarketDay): DayFinance => {
    const sales = roundCents(
      products.reduce(
        (sum, product) => sum + tallyOf(counts, day, product.id).paid * product.price,
        0,
      ),
    );
    const donation = donations[day] ?? 0;
    return { sales, donation, total: roundCents(sales + donation) };
  };
  const days = { samstag: dayOf('samstag'), sonntag: dayOf('sonntag') };
  const revenue = roundCents(days.samstag.total + days.sonntag.total);
  const spent = roundCents(expenses.reduce((sum, entry) => sum + entry.amount, 0));
  return { days, revenue, fee, expenses: spent, profit: roundCents(revenue - fee - spent) };
}

// ---- Cash count (Kassensturz) -------------------------------------------------------------

/** Number of notes and coins by value, e.g. { "5": 3 }. */
export type Pieces = Readonly<Record<string, number>>;

export function piecesSum(pieces: Pieces): number {
  return roundCents(
    DENOMINATIONS.reduce((sum, value) => sum + (pieces[String(value)] ?? 0) * value, 0),
  );
}

export interface Withdrawal {
  id: string;
  amount: number;
  reason: string;
}

/** The cash count of one day: change in the morning, cash in the evening and what was taken out. */
export interface Sturz {
  start: Pieces;
  evening: Pieces;
  withdrawals: Withdrawal[];
}

export function emptySturz(): Sturz {
  return { start: {}, evening: {}, withdrawals: [] };
}

export interface SturzResult {
  start: number;
  sales: number;
  donation: number;
  withdrawn: number;
  /** What should be in the box. */
  expected: number;
  /** What was counted in the evening. */
  counted: number;
  difference: number;
  /** The evening count was done. */
  done: boolean;
}

export function sturzResult(sturz: Sturz, sales: number, donation: number): SturzResult {
  const start = piecesSum(sturz.start);
  const counted = piecesSum(sturz.evening);
  const withdrawn = roundCents(sturz.withdrawals.reduce((sum, entry) => sum + entry.amount, 0));
  const expected = roundCents(start + sales + donation - withdrawn);
  return {
    start,
    sales,
    donation,
    withdrawn,
    expected,
    counted,
    difference: roundCents(counted - expected),
    done: counted > 0,
  };
}

export interface Verdict {
  tone: 'none' | 'ok' | 'warn' | 'bad';
  text: string;
}

export function sturzVerdict(result: SturzResult, money: (value: number) => string): Verdict {
  if (!result.done) {
    return { tone: 'none', text: 'Trag das Bargeld vom Abend ein, dann steht hier die Differenz.' };
  }
  const gap = Math.abs(result.difference);
  if (gap < 0.005) return { tone: 'ok', text: 'Die Kasse stimmt auf den Cent.' };
  return {
    tone: gap <= 2 ? 'warn' : 'bad',
    text:
      result.difference > 0
        ? `Es sind ${money(gap)} zu viel in der Kasse.`
        : `Es fehlen ${money(gap)}.`,
  };
}

// ---- Stock and shopping list ---------------------------------------------------------------

export const CATEGORIES: readonly string[] = ['Zutaten', 'Technik', 'Verpackung', 'Orga'];

export const STATUSES: readonly string[] = ['Offen', 'Vorbereitet', 'Verteilt', 'Erledigt'];

export const SHOPS: readonly string[] = [
  'Kruber',
  'E-Center',
  'REWE',
  'Lidl',
  'Aldi',
  'Penny',
  'Netto',
  'Kaufland',
  'Metro',
  'Online',
  'Sonstiges',
];

export interface StockItem {
  id: string;
  category: string;
  name: string;
  /** Where it is kept, e.g. "Box 3". */
  box: string;
  status: string;
  need: number;
  unit: string;
  stock: number;
  /** Size of one pack in the unit of the item; 0 when it is bought by the unit. */
  pack: number;
  /** Price per pack, or per unit without a pack size. */
  price: number;
  store: string;
  /** Put on the shopping list by hand or taken off it; null follows the category. */
  onList: boolean | null;
  bought: boolean;
  /** The number of packs that were bought, 0 while it is the number that is missing. */
  boughtPacks: number;
}

/** Ingredients and shopping are bought, the other things are only counted. */
export function isShoppingCategory(category: string): boolean {
  return /zutat|einkauf|einkäuf/i.test(category);
}

export function onShoppingList(item: StockItem): boolean {
  return item.onList ?? isShoppingCategory(item.category);
}

export interface Buy {
  /** Amount in the unit of the item that is still missing. */
  missing: number;
  packs: number;
  /** The packs that count for the price: those bought, else those that are missing. */
  shownPacks: number;
  total: number;
  done: boolean;
}

export function buyOf(item: StockItem): Buy {
  const missing = Math.max(0, roundCents(item.need - item.stock));
  const packs = missing <= 0 ? 0 : item.pack > 0 ? Math.ceil(missing / item.pack - 1e-9) : missing;
  const shownPacks = item.bought && item.boughtPacks > 0 ? item.boughtPacks : packs;
  return {
    missing,
    packs,
    shownPacks,
    total: roundCents(shownPacks * item.price),
    done: item.bought,
  };
}

export interface ShoppingTotals {
  articles: number;
  /** Articles that are still missing. */
  missing: number;
  open: number;
  done: number;
  total: number;
}

export function shoppingTotals(items: readonly StockItem[]): ShoppingTotals {
  const totals: ShoppingTotals = { articles: 0, missing: 0, open: 0, done: 0, total: 0 };
  for (const item of items.filter(onShoppingList)) {
    const buy = buyOf(item);
    totals.articles += 1;
    if (buy.done) totals.done = roundCents(totals.done + buy.total);
    else {
      if (buy.missing > 0) totals.missing += 1;
      totals.open = roundCents(totals.open + buy.total);
    }
  }
  totals.total = roundCents(totals.open + totals.done);
  return totals;
}

/** "22,5" or "3" in German. */
export function numberText(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

/** "12 Kartons" or "22,5 l". */
export function quantity(value: number, unit: string): string {
  return unit ? `${numberText(value)} ${unit}` : numberText(value);
}

// ---- Recipe --------------------------------------------------------------------------------

export type Rounding = '' | 'up' | 'half';

export interface Ingredient {
  id: string;
  name: string;
  /** For the base amount of the recipe. */
  amount: number;
  unit: string;
  /** Whole pieces round up, bags go in halves. */
  rounding: Rounding;
  /** Water and the like is not bought. */
  buy: boolean;
}

export interface Recipe {
  name: string;
  /** Litres the amounts are written for. */
  baseLiters: number;
  ingredients: Ingredient[];
  steps: string;
  note: string;
}

export interface Portion {
  name: string;
  unit: string;
  amount: number;
  buy: boolean;
}

function rounded(ingredient: Ingredient, amount: number): number {
  if (ingredient.rounding === 'up') return Math.ceil(amount - 1e-9);
  if (ingredient.rounding === 'half') return Math.round(amount / 0.5) * 0.5;
  return Math.round(amount * 100) / 100;
}

export function scaleRecipe(recipe: Recipe, liters: number): Portion[] {
  const factor = liters / (recipe.baseLiters || 1);
  return recipe.ingredients.map((ingredient) => ({
    name: ingredient.name,
    unit: ingredient.unit,
    amount: rounded(ingredient, ingredient.amount * factor),
    buy: ingredient.buy,
  }));
}

function plainName(name: string): string {
  return name
    .toLocaleLowerCase('de')
    .replace(/\s*\(.*?\)\s*/g, '')
    .trim();
}

/** The article of the stock with this name; one of the shopping categories wins. */
export function findStockItem(items: readonly StockItem[], name: string): StockItem | undefined {
  const same = items.filter((item) => plainName(item.name) === plainName(name));
  return same.find((item) => isShoppingCategory(item.category)) ?? same[0];
}

// ---- Setting up and taking down ----------------------------------------------------------------

export type Phase = 'aufbau' | 'abbau';

export interface Step {
  id: string;
  phase: Phase;
  /** "12:30" or empty. */
  time: string;
  title: string;
  text: string;
  done: boolean;
}

export interface Note {
  id: string;
  title: string;
  text: string;
}

export const STANDARD_ABBAU: readonly string[] = [
  'Letzte Kasse zählen und den Tag abschließen',
  'Geräte ausschalten, Strom trennen und Kabel aufrollen',
  'Waffeleisen und Geschirr reinigen und verpacken',
  'Reste und Müll entsorgen',
  'Leihgaben einsammeln',
  'Stand aufräumen, abschließen und Schlüssel abgeben',
];
