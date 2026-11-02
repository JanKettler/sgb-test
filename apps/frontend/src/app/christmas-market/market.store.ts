import { Injectable, computed, inject, signal } from '@angular/core';
import { roundCents } from '../core/money';
import { StartStore } from '../start/start.store';
import { TrainingStore } from '../training/training.store';
import { CashStore } from '../youth/cash.store';
import {
  CATEGORIES,
  Closing,
  Counts,
  DAY_NAME,
  DoughSpot,
  FIELD_NAME,
  MARKET_DAYS,
  MarketDay,
  MarketExpense,
  Note,
  Phase,
  Pieces,
  Product,
  Recipe,
  SHOPS,
  Slot,
  SlotField,
  STANDARD_ABBAU,
  Step,
  StockItem,
  Sturz,
  SturzResult,
  Tally,
  TallyType,
  buyOf,
  countdownOf,
  dayDate,
  emptySturz,
  financeOf,
  findStockItem,
  marketSaturday,
  onShoppingList,
  sameName,
  scaleRecipe,
  shoppingTotals,
  shownName,
  slotFull,
  sturzResult,
  tallyKey,
  tallyOf,
} from './market.models';
import {
  sampleDough,
  sampleExpenses,
  sampleNotes,
  sampleProducts,
  sampleRecipe,
  sampleSlots,
  sampleSteps,
  sampleStock,
} from './market.sample';

/** What the last booking changed, so that it can be taken back. */
export interface LastBooking {
  day: MarketDay;
  productId: string;
  type: TallyType;
  delta: number;
}

/** One line of the plan that shows what the recipe changes in the shopping list. */
export interface TransferLine {
  name: string;
  unit: string;
  amount: number;
  /** The article is in the stock list already. */
  known: boolean;
  /** The need before, empty for a new article. */
  before: string;
}

/** An entry of the person who is logged in, for the list "Meine Schichten". */
export interface MyShift {
  key: string;
  day: MarketDay;
  what: string;
  name: string;
  slotId: string;
  field: SlotField | null;
  /** Index in the list of the slot; for the dough the id of the spot is used. */
  index: number;
}

/** In-memory stand-in for the future market API. All data is invented. */
@Injectable({ providedIn: 'root' })
export class MarketStore {
  private readonly training = inject(TrainingStore);
  private readonly start = inject(StartStore);
  private readonly cash = inject(CashStore);
  private counter = 100;
  readonly today = this.training.today;

  /** The organisers run the market, everybody else may put themselves on the helper list. */
  readonly canOrganize = this.training.canManage;
  readonly isAdmin = this.training.isAdmin;
  readonly me = this.start.userName;

  readonly saturday = signal(marketSaturday(this.today));
  readonly year = computed(() => this.saturday().slice(0, 4));
  readonly countdown = computed(() => countdownOf(this.today, this.saturday()));
  readonly notice = signal(
    'Bitte trag dich nur ein, wenn du sicher Zeit hast. Wer nicht mehr kann, trägt sich bitte selbst wieder aus.',
  );

  // ---- Helper lists -------------------------------------------------------------------------

  readonly slots = signal<Slot[]>(sampleSlots());
  readonly dough = signal<DoughSpot[]>(sampleDough());

  dateOf(day: MarketDay): string {
    return dayDate(this.saturday(), day);
  }

  slotsOf(day: MarketDay): Slot[] {
    return this.slots().filter((slot) => slot.day === day);
  }

  doughOf(day: MarketDay): DoughSpot[] {
    return this.dough()
      .filter((spot) => spot.day === day)
      .sort((a, b) => a.no - b.no);
  }

  isMine(name: string): boolean {
    return sameName(name, this.me());
  }

  /** Organisers and the person themselves see the whole name, the others only the first name. */
  shown(name: string): string {
    return shownName(name, this.canOrganize() || this.isMine(name));
  }

  canRemove(name: string): boolean {
    return this.canOrganize() || this.isMine(name);
  }

  /** Puts a name on a line; without a name the person who is logged in. */
  signUp(slotId: string, field: SlotField, name = ''): string {
    const clean = (name || this.me()).trim();
    const slot = this.slots().find((item) => item.id === slotId);
    if (!slot) return 'Diese Zeile gibt es nicht mehr.';
    if (name && !this.isMine(clean) && !this.canOrganize()) {
      return 'Andere trägt nur das Orga-Team ein.';
    }
    if (slot[field].some((entry) => sameName(entry, clean))) {
      return `${this.isMine(clean) ? 'Du stehst' : `${clean} steht`} hier schon als ${FIELD_NAME[field]}.`;
    }
    if (slotFull(slot, field)) return 'Diese Zeit ist schon voll.';
    this.slots.update((all) =>
      all.map((item) =>
        item.id === slotId ? { ...item, [field]: [...item[field], clean] } : item,
      ),
    );
    return '';
  }

  signOff(slotId: string, field: SlotField, index: number): void {
    const slot = this.slots().find((item) => item.id === slotId);
    const name = slot?.[field][index];
    if (!slot || name === undefined || !this.canRemove(name)) return;
    this.slots.update((all) =>
      all.map((item) =>
        item.id === slotId ? { ...item, [field]: item[field].filter((_, i) => i !== index) } : item,
      ),
    );
  }

  newSlot(day: MarketDay): Slot {
    return {
      id: '',
      day,
      label: '',
      helpers: [],
      maxHelpers: 4,
      supervisors: [],
      maxSupervisors: 1,
      note: '',
    };
  }

  /** Saves a line; the people on it stay when the limits change. */
  saveSlot(slot: Slot): string {
    if (!slot.label.trim()) return 'Bitte die Zeit eintragen, zum Beispiel 12:00–14:00.';
    if (!slot.id) {
      this.slots.update((all) => [
        ...all,
        { ...slot, id: this.nextId('s'), label: slot.label.trim() },
      ]);
      return '';
    }
    this.slots.update((all) =>
      all.map((item) => (item.id === slot.id ? { ...slot, label: slot.label.trim() } : item)),
    );
    return '';
  }

  removeSlot(id: string): void {
    this.slots.update((all) => all.filter((slot) => slot.id !== id));
  }

  /** Moves a line up or down among the lines of its day. */
  moveSlot(id: string, delta: -1 | 1): void {
    this.slots.update((all) => {
      const slot = all.find((item) => item.id === id);
      if (!slot) return all;
      const same = all.filter((item) => item.day === slot.day);
      const from = same.findIndex((item) => item.id === id);
      const to = from + delta;
      if (to < 0 || to >= same.length) return all;
      const order = [...same];
      [order[from], order[to]] = [order[to], order[from]];
      const others = all.filter((item) => item.day !== slot.day);
      return slot.day === 'samstag' ? [...order, ...others] : [...others, ...order];
    });
  }

  claimDough(id: string, name = ''): string {
    const clean = (name || this.me()).trim();
    const spot = this.dough().find((item) => item.id === id);
    if (!spot) return 'Diesen Platz gibt es nicht mehr.';
    if (spot.name) return 'Der Platz ist schon vergeben.';
    if (name && !this.isMine(clean) && !this.canOrganize()) {
      return 'Andere trägt nur das Orga-Team ein.';
    }
    this.dough.update((all) =>
      all.map((item) => (item.id === id ? { ...item, name: clean } : item)),
    );
    return '';
  }

  releaseDough(id: string): void {
    const spot = this.dough().find((item) => item.id === id);
    if (!spot || !spot.name || !this.canRemove(spot.name)) return;
    this.dough.update((all) => all.map((item) => (item.id === id ? { ...item, name: '' } : item)));
  }

  /** One place more or less for the dough; only a free last place can be taken away. */
  resizeDough(day: MarketDay, delta: -1 | 1): string {
    const spots = this.doughOf(day);
    if (delta > 0) {
      const no = (spots.at(-1)?.no ?? 0) + 1;
      this.dough.update((all) => [...all, { id: this.nextId('t'), day, no, name: '' }]);
      return '';
    }
    const last = spots.at(-1);
    if (!last) return '';
    if (last.name) return 'Der letzte Platz ist vergeben. Bitte erst austragen.';
    this.dough.update((all) => all.filter((spot) => spot.id !== last.id));
    return '';
  }

  setNotice(text: string): void {
    this.notice.set(text.trim());
  }

  setSaturday(iso: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Bitte ein Datum eintragen.';
    this.saturday.set(iso);
    return '';
  }

  /** Everything the person who is logged in is signed up for. */
  readonly myShifts = computed<MyShift[]>(() => {
    const out: MyShift[] = [];
    for (const day of MARKET_DAYS) {
      for (const slot of this.slotsOf(day)) {
        for (const field of ['helpers', 'supervisors'] as const) {
          slot[field].forEach((name, index) => {
            if (this.isMine(name)) {
              out.push({
                key: `${slot.id}-${field}-${index}`,
                day,
                what: `${slot.label} · ${FIELD_NAME[field]}`,
                name,
                slotId: slot.id,
                field,
                index,
              });
            }
          });
        }
      }
      for (const spot of this.doughOf(day)) {
        if (spot.name && this.isMine(spot.name)) {
          out.push({
            key: spot.id,
            day,
            what: `Waffelteig · Platz ${spot.no}`,
            name: spot.name,
            slotId: spot.id,
            field: null,
            index: 0,
          });
        }
      }
    }
    return out;
  });

  // ---- Cash desk ----------------------------------------------------------------------------

  readonly products = signal<Product[]>(sampleProducts());
  readonly counts = signal<Counts>({});
  readonly donations = signal<Record<MarketDay, number>>({ samstag: 0, sonntag: 0 });
  /** Fee for the stand. */
  readonly fee = signal(45);
  /** How many waffles one batch of dough makes. */
  readonly wafflesPerBatch = signal(15);
  readonly closings = signal<Record<MarketDay, Closing | null>>({ samstag: null, sonntag: null });
  readonly sturz = signal<Record<MarketDay, Sturz>>({
    samstag: emptySturz(),
    sonntag: emptySturz(),
  });
  readonly expenses = signal<MarketExpense[]>(sampleExpenses(this.today));
  readonly last = signal<LastBooking | null>(null);

  readonly finance = computed(() =>
    financeOf(this.products(), this.counts(), this.donations(), this.fee(), this.expenses()),
  );

  /** Waffles that were sold or handed out, and the batches of dough they needed. */
  readonly waffles = computed(() =>
    MARKET_DAYS.reduce((sum, day) => {
      const tally = tallyOf(this.counts(), day, 'waffel');
      return sum + tally.paid + tally.free;
    }, 0),
  );
  readonly batches = computed(() =>
    this.wafflesPerBatch() > 0 ? Math.ceil(this.waffles() / this.wafflesPerBatch()) : 0,
  );

  tally(day: MarketDay, productId: string): Tally {
    return tallyOf(this.counts(), day, productId);
  }

  isClosed(day: MarketDay): boolean {
    return this.closings()[day] !== null;
  }

  private frozen(day: MarketDay): string {
    if (!this.canOrganize()) return 'Die Kasse bedient das Orga-Team.';
    return this.isClosed(day) ? `${DAY_NAME[day]} ist abgeschlossen.` : '';
  }

  /** Counts one more or one less; returns what is wrong, or an empty text. */
  count(day: MarketDay, productId: string, type: TallyType, delta: number): string {
    const problem = this.frozen(day);
    if (problem) return problem;
    const current = this.tally(day, productId);
    const next = Math.max(0, current[type] + delta);
    if (next === current[type]) return '';
    this.counts.update((all) => ({
      ...all,
      [tallyKey(day, productId)]: { ...current, [type]: next },
    }));
    this.last.set({ day, productId, type, delta: next - current[type] });
    return '';
  }

  /** Takes back the last booking. */
  undo(): string {
    const last = this.last();
    if (!last) return '';
    const problem = this.frozen(last.day);
    if (problem) return problem;
    const current = this.tally(last.day, last.productId);
    this.counts.update((all) => ({
      ...all,
      [tallyKey(last.day, last.productId)]: {
        ...current,
        [last.type]: Math.max(0, current[last.type] - last.delta),
      },
    }));
    this.last.set(null);
    return '';
  }

  setDonation(day: MarketDay, amount: number): string {
    const problem = this.frozen(day);
    if (problem) return problem;
    if (!Number.isFinite(amount) || amount < 0) return 'Die Spende kann nicht negativ sein.';
    this.donations.update((all) => ({ ...all, [day]: roundCents(amount) }));
    return '';
  }

  setFee(amount: number): string {
    if (!Number.isFinite(amount) || amount < 0) return 'Die Standgebühr kann nicht negativ sein.';
    this.fee.set(roundCents(amount));
    return '';
  }

  setWafflesPerBatch(count: number): void {
    this.wafflesPerBatch.set(Math.max(0, Math.floor(count)));
  }

  saveProduct(product: Product): string {
    if (!product.name.trim()) return 'Bitte einen Namen eintragen.';
    if (!Number.isFinite(product.price) || product.price < 0) return 'Der Preis ist nicht gültig.';
    const clean = { ...product, name: product.name.trim(), unit: product.unit.trim() || 'Stück' };
    if (!clean.id) {
      this.products.update((all) => [...all, { ...clean, id: this.nextId('p'), builtin: false }]);
      return '';
    }
    this.products.update((all) => all.map((item) => (item.id === clean.id ? clean : item)));
    return '';
  }

  removeProduct(id: string): void {
    const product = this.products().find((item) => item.id === id);
    if (!product || product.builtin) return;
    this.products.update((all) => all.filter((item) => item.id !== id));
  }

  /** Closes a day: afterwards nothing can be booked or changed for it. */
  closeDay(day: MarketDay): string {
    if (!this.canOrganize()) return 'Das darf nur das Orga-Team.';
    if (this.isClosed(day)) return '';
    this.closings.update((all) => ({ ...all, [day]: { at: this.today, by: this.me() } }));
    return '';
  }

  reopenDay(day: MarketDay): string {
    if (!this.isAdmin()) return 'Nur der Vorstand kann einen Tag wieder öffnen.';
    this.closings.update((all) => ({ ...all, [day]: null }));
    return '';
  }

  sturzOf(day: MarketDay): Sturz {
    return this.sturz()[day];
  }

  resultOf(day: MarketDay): SturzResult {
    const money = this.finance().days[day];
    return sturzResult(this.sturzOf(day), money.sales, money.donation);
  }

  /** The count of the morning (change) or of the evening. */
  saveCount(day: MarketDay, when: 'start' | 'evening', pieces: Pieces): string {
    const problem = this.frozen(day);
    if (problem) return problem;
    this.sturz.update((all) => ({ ...all, [day]: { ...all[day], [when]: pieces } }));
    return '';
  }

  addWithdrawal(day: MarketDay, amount: number, reason: string): string {
    const problem = this.frozen(day);
    if (problem) return problem;
    if (!(amount > 0)) return 'Der Betrag muss größer als 0 sein.';
    if (!reason.trim()) return 'Bitte den Grund eintragen.';
    const entry = { id: this.nextId('w'), amount: roundCents(amount), reason: reason.trim() };
    this.sturz.update((all) => ({
      ...all,
      [day]: { ...all[day], withdrawals: [...all[day].withdrawals, entry] },
    }));
    return '';
  }

  removeWithdrawal(day: MarketDay, id: string): void {
    if (this.frozen(day)) return;
    this.sturz.update((all) => ({
      ...all,
      [day]: { ...all[day], withdrawals: all[day].withdrawals.filter((entry) => entry.id !== id) },
    }));
  }

  saveExpense(expense: MarketExpense): string {
    if (!expense.text.trim()) return 'Bitte den Verwendungszweck eintragen.';
    if (!(expense.amount > 0)) return 'Der Betrag muss größer als 0 sein.';
    const clean = { ...expense, text: expense.text.trim(), amount: roundCents(expense.amount) };
    if (!clean.id) {
      this.expenses.update((all) => [...all, { ...clean, id: this.nextId('e') }]);
      return '';
    }
    this.expenses.update((all) => all.map((item) => (item.id === clean.id ? clean : item)));
    return '';
  }

  removeExpense(id: string): void {
    this.expenses.update((all) => all.filter((item) => item.id !== id));
  }

  // ---- Profit into the youth cash --------------------------------------------------------------

  readonly bookingRef = computed(() => `wm:${this.year()}`);
  /** The booking of the profit in the youth cash, if it was made. */
  readonly booked = computed(() =>
    this.cash.entries().find((entry) => entry.ref === this.bookingRef()),
  );

  /** Books the profit as income of the youth cash; once per market. */
  bookProfit(): string {
    if (!this.canOrganize()) return 'Das bucht das Orga-Team.';
    if (this.booked()) return 'Der Gewinn ist schon in der Jugendkasse gebucht.';
    const profit = this.finance().profit;
    if (!(profit > 0)) return 'Es gibt keinen Gewinn zu buchen.';
    return this.cash.book({
      kind: 'in',
      amount: profit,
      date: this.today,
      category: 'Veranstaltung',
      text: `Weihnachtsmarkt ${this.year()}: Gewinn`,
      receipt: '',
      ref: this.bookingRef(),
    });
  }

  // ---- Stock and shopping list ----------------------------------------------------------------

  readonly stock = signal<StockItem[]>(sampleStock());
  readonly shopping = computed(() => this.stock().filter(onShoppingList));
  readonly totals = computed(() => shoppingTotals(this.stock()));
  readonly categories = computed(() => [
    ...new Set([...CATEGORIES, ...this.stock().map((item) => item.category)]),
  ]);
  readonly shops = computed(() => [
    ...new Set([
      ...SHOPS,
      ...this.stock()
        .map((item) => item.store)
        .filter(Boolean),
    ]),
  ]);

  newItem(category = CATEGORIES[0]): StockItem {
    return {
      id: '',
      category,
      name: '',
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
    };
  }

  saveItem(item: StockItem): string {
    if (!item.name.trim()) return 'Bitte einen Namen eintragen.';
    if (item.need < 0 || item.stock < 0 || item.pack < 0 || item.price < 0) {
      return 'Mengen und Preise können nicht negativ sein.';
    }
    const clean = {
      ...item,
      name: item.name.trim(),
      category: item.category.trim() || CATEGORIES[0],
    };
    if (!clean.id) {
      this.stock.update((all) => [...all, { ...clean, id: this.nextId('i') }]);
      return '';
    }
    this.stock.update((all) => all.map((entry) => (entry.id === clean.id ? clean : entry)));
    return '';
  }

  removeItem(id: string): void {
    this.stock.update((all) => all.filter((item) => item.id !== id));
  }

  private patchItem(id: string, change: Partial<StockItem>): void {
    this.stock.update((all) => all.map((item) => (item.id === id ? { ...item, ...change } : item)));
  }

  setStatus(id: string, status: string): void {
    this.patchItem(id, { status });
  }

  setStock(id: string, value: number): void {
    if (Number.isFinite(value) && value >= 0) this.patchItem(id, { stock: value });
  }

  /** Ticks an article as bought; the packs that were missing are kept as the packs bought. */
  toggleBought(id: string): void {
    const item = this.stock().find((entry) => entry.id === id);
    if (!item) return;
    this.patchItem(
      id,
      item.bought
        ? { bought: false, boughtPacks: 0 }
        : { bought: true, boughtPacks: buyOf(item).packs },
    );
  }

  /** Puts an article on the shopping list or takes it off; the category decides without a choice. */
  toggleOnList(id: string): void {
    const item = this.stock().find((entry) => entry.id === id);
    if (item) this.patchItem(id, { onList: !onShoppingList(item) });
  }

  // ---- Recipe ----------------------------------------------------------------------------------

  readonly recipe = signal<Recipe>(sampleRecipe());

  saveRecipe(change: Pick<Recipe, 'steps' | 'note'>): void {
    this.recipe.update((old) => ({ ...old, steps: change.steps.trim(), note: change.note.trim() }));
  }

  /** What the recipe for this many litres would change in the shopping list. */
  transferPlan(liters: number): TransferLine[] {
    return scaleRecipe(this.recipe(), liters)
      .filter((portion) => portion.buy)
      .map((portion) => {
        const found = findStockItem(this.stock(), portion.name);
        return {
          name: portion.name,
          unit: portion.unit,
          amount: portion.amount,
          known: !!found,
          before: found ? `${found.need}${found.unit ? ` ${found.unit}` : ''}` : '',
        };
      });
  }

  /** Sets the need of the ingredients to the amounts of the recipe; unknown ones are added. */
  applyRecipe(liters: number): number {
    const plan = this.transferPlan(liters);
    for (const line of plan) {
      const found = findStockItem(this.stock(), line.name);
      if (found) {
        this.patchItem(found.id, { need: line.amount, unit: found.unit || line.unit });
      } else {
        this.stock.update((all) => [
          ...all,
          {
            ...this.newItem('Zutaten'),
            id: this.nextId('i'),
            name: line.name,
            need: line.amount,
            unit: line.unit,
          },
        ]);
      }
    }
    return plan.length;
  }

  // ---- Setting up and taking down ----------------------------------------------------------------

  readonly steps = signal<Step[]>(sampleSteps());
  readonly notes = signal<Note[]>(sampleNotes());

  stepsOf(phase: Phase): Step[] {
    return this.steps().filter((step) => step.phase === phase);
  }

  toggleStep(id: string): void {
    this.steps.update((all) =>
      all.map((step) => (step.id === id ? { ...step, done: !step.done } : step)),
    );
  }

  newStep(phase: Phase): Step {
    return { id: '', phase, time: '', title: '', text: '', done: false };
  }

  saveStep(step: Step): string {
    if (!step.title.trim()) return 'Bitte den Schritt beschreiben.';
    const clean = {
      ...step,
      title: step.title.trim(),
      text: step.text.trim(),
      time: step.time.trim(),
    };
    if (!clean.id) {
      this.steps.update((all) => [...all, { ...clean, id: this.nextId('a') }]);
      return '';
    }
    this.steps.update((all) => all.map((item) => (item.id === clean.id ? clean : item)));
    return '';
  }

  removeStep(id: string): void {
    this.steps.update((all) => all.filter((step) => step.id !== id));
  }

  /** Moves a step up or down among the steps of its phase. */
  moveStep(id: string, delta: -1 | 1): void {
    this.steps.update((all) => {
      const step = all.find((item) => item.id === id);
      if (!step) return all;
      const same = all.filter((item) => item.phase === step.phase);
      const from = same.findIndex((item) => item.id === id);
      const to = from + delta;
      if (to < 0 || to >= same.length) return all;
      const order = [...same];
      [order[from], order[to]] = [order[to], order[from]];
      const others = all.filter((item) => item.phase !== step.phase);
      return step.phase === 'aufbau' ? [...order, ...others] : [...others, ...order];
    });
  }

  /** Adds the usual steps for taking down, as long as there are none. */
  addStandardAbbau(): void {
    if (this.stepsOf('abbau').length > 0) return;
    this.steps.update((all) => [
      ...all,
      ...STANDARD_ABBAU.map((title) => ({
        id: this.nextId('a'),
        phase: 'abbau' as const,
        time: '',
        title,
        text: '',
        done: false,
      })),
    ]);
  }

  newNote(): Note {
    return { id: '', title: '', text: '' };
  }

  saveNote(note: Note): string {
    if (!note.title.trim()) return 'Bitte eine Überschrift eintragen.';
    const clean = { ...note, title: note.title.trim(), text: note.text.trim() };
    if (!clean.id) {
      this.notes.update((all) => [...all, { ...clean, id: this.nextId('n') }]);
      return '';
    }
    this.notes.update((all) => all.map((item) => (item.id === clean.id ? clean : item)));
    return '';
  }

  removeNote(id: string): void {
    this.notes.update((all) => all.filter((note) => note.id !== id));
  }

  private nextId(prefix: string): string {
    return `${prefix}-${++this.counter}`;
  }
}
