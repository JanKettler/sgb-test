import { addDays } from '../training/training-dates';
import {
  DoughSpot,
  Ingredient,
  MarketExpense,
  Note,
  Product,
  Recipe,
  Slot,
  Step,
  StockItem,
} from './market.models';

/** Invented sample data for the market; no real people, prices or addresses. */

export function sampleProducts(): Product[] {
  return [
    {
      id: 'waffel',
      name: 'Belgische Waffeln',
      unit: 'Stück',
      price: 2,
      tone: 'warning',
      icon: 'waffle',
      builtin: true,
    },
    {
      id: 'kinderpunsch',
      name: 'Kinderpunsch',
      unit: 'Becher',
      price: 2,
      tone: 'danger',
      icon: 'mug',
      builtin: true,
    },
  ];
}

function slot(
  id: string,
  day: Slot['day'],
  label: string,
  helpers: string[],
  supervisors: string[],
  note = '',
): Slot {
  return { id, day, label, helpers, maxHelpers: 4, supervisors, maxSupervisors: 1, note };
}

export function sampleSlots(): Slot[] {
  return [
    slot('s-1', 'samstag', '12:00–14:00', ['Lena Muster', 'Tim Probst'], ['Maria Beispiel']),
    slot('s-2', 'samstag', '14:00–16:00', ['Nora Kranz', 'Sabine Beispiel'], []),
    slot('s-3', 'samstag', '16:00–18:00', ['Ole Brandt'], [], 'Danach Abbau'),
    slot('s-4', 'sonntag', '11:00–13:00', ['Hanna Berg', 'Kai Dorn'], ['Jonas Beispiel']),
    slot('s-5', 'sonntag', '13:00–15:00', [], []),
    slot('s-6', 'sonntag', '15:00–17:00', ['Paula Winter'], [], 'Danach Abbau'),
  ];
}

export function sampleDough(): DoughSpot[] {
  const named: Record<string, string> = {
    'samstag-1': 'Frieda Lindner',
    'samstag-2': 'Sabine Beispiel',
    'sonntag-1': 'Ben Sommer',
  };
  return (['samstag', 'sonntag'] as const).flatMap((day) =>
    Array.from({ length: 5 }, (_, index) => ({
      id: `t-${day}-${index + 1}`,
      day,
      no: index + 1,
      name: named[`${day}-${index + 1}`] ?? '',
    })),
  );
}

export function sampleExpenses(today: string): MarketExpense[] {
  return [
    {
      id: 'e-1',
      date: addDays(today, -9),
      text: 'Plakate und Flyer drucken',
      amount: 12.5,
      receipt: true,
    },
    {
      id: 'e-2',
      date: addDays(today, -3),
      text: 'Ersatzteil für ein Waffeleisen',
      amount: 18.9,
      receipt: false,
    },
  ];
}

function item(id: string, category: string, name: string, data: Partial<StockItem>): StockItem {
  return {
    id,
    category,
    name,
    box: '',
    status: 'Offen',
    need: 0,
    unit: '',
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

export function sampleStock(): StockItem[] {
  return [
    item('i-1', 'Zutaten', 'Weizenmehl', {
      need: 12,
      unit: 'kg',
      stock: 2,
      pack: 1,
      price: 1.29,
      store: 'Kruber',
    }),
    item('i-2', 'Zutaten', 'Zucker', {
      need: 6,
      unit: 'kg',
      stock: 1,
      pack: 1,
      price: 1.19,
      store: 'Kruber',
    }),
    item('i-3', 'Zutaten', 'Eier', {
      need: 120,
      unit: 'Stk.',
      stock: 0,
      pack: 10,
      price: 2.49,
      store: 'E-Center',
    }),
    item('i-4', 'Zutaten', 'Butter', {
      need: 8,
      unit: 'kg',
      stock: 0,
      pack: 0.25,
      price: 2.19,
      store: 'Lidl',
    }),
    item('i-5', 'Zutaten', 'Milch', {
      need: 12,
      unit: 'l',
      stock: 0,
      pack: 1,
      price: 1.09,
      store: 'Lidl',
    }),
    item('i-6', 'Zutaten', 'Vanillezucker', {
      need: 30,
      unit: 'Btl.',
      stock: 6,
      pack: 10,
      price: 1.39,
      store: 'Kruber',
    }),
    item('i-7', 'Zutaten', 'Wintertee', {
      need: 10,
      unit: 'Btl.',
      stock: 0,
      pack: 20,
      price: 2.49,
      store: 'REWE',
    }),
    item('i-8', 'Zutaten', 'Orangensaft', {
      need: 1,
      unit: 'l',
      stock: 0,
      pack: 1,
      price: 1.49,
      store: 'Lidl',
    }),
    item('i-9', 'Zutaten', 'Apfelsaft', {
      need: 2.5,
      unit: 'l',
      stock: 1,
      pack: 1,
      price: 1.29,
      store: 'Lidl',
    }),
    item('i-10', 'Zutaten', 'Roter Traubensaft', {
      need: 2.5,
      unit: 'l',
      stock: 0,
      pack: 1,
      price: 1.79,
      store: 'Lidl',
    }),
    item('i-11', 'Zutaten', 'Zimtstangen', {
      need: 2,
      unit: 'Stk.',
      stock: 0,
      pack: 4,
      price: 1.99,
      store: 'REWE',
    }),
    item('i-12', 'Zutaten', 'Glühfix', {
      need: 5,
      unit: 'Btl.',
      stock: 0,
      pack: 3,
      price: 2.29,
      store: 'REWE',
    }),
    item('i-13', 'Verpackung', 'Pappbecher', {
      need: 400,
      unit: 'Stk.',
      stock: 120,
      pack: 100,
      price: 6.9,
      store: 'Metro',
      box: 'Box 4',
      onList: true,
    }),
    item('i-14', 'Verpackung', 'Servietten', {
      need: 500,
      unit: 'Stk.',
      stock: 500,
      pack: 250,
      price: 2.5,
      store: 'Metro',
      box: 'Box 4',
      status: 'Verteilt',
    }),
    item('i-15', 'Technik', 'Waffeleisen', {
      need: 4,
      unit: 'Stk.',
      stock: 4,
      box: 'Box 1',
      status: 'Vorbereitet',
    }),
    item('i-16', 'Technik', 'Kabeltrommel', {
      need: 2,
      unit: 'Stk.',
      stock: 2,
      box: 'Box 1',
      status: 'Vorbereitet',
    }),
    item('i-17', 'Technik', 'Wasserkocher', {
      need: 2,
      unit: 'Stk.',
      stock: 1,
      box: 'Box 2',
    }),
    item('i-18', 'Orga', 'Kassenbox mit Wechselgeld', { box: 'Box 3', status: 'Offen' }),
    item('i-19', 'Orga', 'Preisschilder und Aushang', { box: 'Box 3', status: 'Offen' }),
  ];
}

function ingredient(
  id: string,
  name: string,
  amount: number,
  unit: string,
  extra: Partial<Ingredient> = {},
): Ingredient {
  return { id, name, amount, unit, rounding: '', buy: true, ...extra };
}

export function sampleRecipe(): Recipe {
  return {
    name: 'Winter-Kinderpunsch',
    baseLiters: 8,
    ingredients: [
      ingredient('z-1', 'Wasser', 2, 'l', { buy: false }),
      ingredient('z-2', 'Wintertee', 10, 'Btl.', { rounding: 'half' }),
      ingredient('z-3', 'Orangensaft', 1, 'l'),
      ingredient('z-4', 'Apfelsaft', 2.5, 'l'),
      ingredient('z-5', 'Roter Traubensaft', 2.5, 'l'),
      ingredient('z-6', 'Zimtstangen', 2, 'Stk.', { rounding: 'up' }),
      ingredient('z-7', 'Glühfix', 5, 'Btl.', { rounding: 'half' }),
    ],
    steps:
      'Tee kochen, ziehen lassen, Beutel raus.\nDen Rest nach und nach zugeben.\nZiehen lassen.',
    note: 'Vereinsrezept für etwa 8 Liter.',
  };
}

export function sampleSteps(): Step[] {
  const step = (id: string, time: string, title: string, text = ''): Step => ({
    id,
    phase: 'aufbau',
    time,
    title,
    text,
    done: false,
  });
  return [
    step('a-1', '09:30', 'Hütte aufschließen', 'Den Schlüssel gibt es bei der Platzwartin.'),
    step('a-2', '10:00', 'Strom prüfen und die Waffeleisen anschließen'),
    step('a-3', '10:30', 'Theke und Tische aufstellen'),
    step('a-4', '11:00', 'Teig und Zutaten bereitstellen'),
    step('a-5', '11:30', 'Kasse einrichten und Wechselgeld zählen'),
  ];
}

export function sampleNotes(): Note[] {
  return [
    {
      id: 'n-1',
      title: 'Strom',
      text: 'An jede Steckdose nur ein Waffeleisen. Der Wasserkocher läuft allein an der zweiten Leitung.',
    },
    {
      id: 'n-2',
      title: 'Hygiene',
      text: 'Haare zusammenbinden, Hände waschen, Teig nur in sauberen Behältern anrühren.',
    },
  ];
}
