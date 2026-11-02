import { TestBed } from '@angular/core/testing';
import { TrainingStore } from '../../training/training.store';
import { MarketStore } from '../market.store';
import { SettlementTab } from './settlement-tab';

describe('SettlementTab', () => {
  function create(role: 'admin' | 'trainer' | 'parent' = 'admin') {
    TestBed.resetTestingModule();
    TestBed.inject(TrainingStore).role.set(role);
    const store = TestBed.inject(MarketStore);
    const fixture = TestBed.createComponent(SettlementTab);
    fixture.detectChanges();
    return { fixture, store, element: fixture.nativeElement as HTMLElement };
  }

  /** 100 € of sales and 7,50 € of donations on the first day. */
  function sell(store: MarketStore) {
    store.count('samstag', 'waffel', 'paid', 30);
    store.count('samstag', 'kinderpunsch', 'paid', 20);
    store.setDonation('samstag', 7.5);
  }

  const squeezed = (element: Element | null | undefined) =>
    element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const labelled = (element: Element | null | undefined, label: string) =>
    element?.querySelector<HTMLElement>(`[aria-label="${label}"]`) ?? null;
  const dialogOf = (element: HTMLElement, selector: string) =>
    element.querySelector(selector) as HTMLElement;
  const type = (element: HTMLElement, selector: string, text: string) => {
    const input = element.querySelector<HTMLInputElement>(selector)!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
  };
  const fact = (element: HTMLElement, label: string) =>
    squeezed(
      Array.from(element.querySelectorAll('dt')).find((term) => squeezed(term) === label)
        ?.nextElementSibling,
    );
  const item = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('.item')).find((entry) =>
      squeezed(entry).includes(text),
    ) as HTMLElement | undefined;

  it('adds up the days, the expenses and the profit', () => {
    const { fixture, store, element } = create();
    sell(store);
    fixture.detectChanges();
    const rows = Array.from(element.querySelectorAll('table tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => squeezed(cell)),
    );
    expect(rows[0]).toEqual(['Samstag', '100,00 €', '7,50 €', '107,50 €']);
    expect(rows[1]).toEqual(['Sonntag', '0,00 €', '0,00 €', '0,00 €']);
    expect(fact(element, 'Gesamtumsatz')).toBe('107,50 €');
    expect(fact(element, 'Standgebühr')).toBe('− 45,00 €');
    expect(fact(element, 'Ausgaben')).toBe('− 31,40 €');
    expect(fact(element, 'Gewinn')).toBe('31,10 €');
  });

  it('works out the waffles and the batches of dough', () => {
    const { fixture, store, element } = create();
    store.count('samstag', 'waffel', 'paid', 28);
    store.count('sonntag', 'waffel', 'free', 3);
    fixture.detectChanges();
    expect(fact(element, 'Waffeln')).toBe('31 insgesamt, davon 3 gratis für die Helfer');
    expect(fact(element, 'Teig')).toBe('3 Teige bei 15 Waffeln pro Teig');
  });

  it('marks a loss', () => {
    const { element } = create();
    expect(fact(element, 'Gewinn')).toBe('-76,40 €');
    expect(element.querySelector('dd .is-late')).toBeTruthy();
  });

  it('books the profit once as income of the youth cash', () => {
    const { fixture, store, element } = create();
    const button = labelled(element, 'In die Jugendkasse buchen') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    sell(store);
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    button.click();
    fixture.detectChanges();
    labelled(dialogOf(element, 'app-confirm-dialog'), 'Buchen')!.click();
    fixture.detectChanges();
    expect(store.booked()?.amount).toBe(31.1);
    expect(squeezed(element.querySelector('.box-note'))).toContain(
      'mit 31,10 € in der Jugendkasse gebucht',
    );
    expect(labelled(element, 'In die Jugendkasse buchen')).toBeNull();
  });

  it('adds, edits and deletes an expense', () => {
    const { fixture, store, element } = create('trainer');
    labelled(element, 'Ausgabe')!.click();
    fixture.detectChanges();
    let dialog = dialogOf(element, 'app-form-dialog');
    type(dialog, '[id$="-text"]', 'Kerzen');
    type(dialog, '[id$="-amount"]', '5.5');
    fixture.detectChanges();
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(store.expenses()).toHaveLength(3);
    expect(squeezed(item(element, 'Kerzen'))).toContain('5,50 €');
    expect(fact(element, 'Ausgaben')).toBe('− 36,90 €');

    labelled(item(element, 'Kerzen'), 'Ausgabe bearbeiten')!.click();
    fixture.detectChanges();
    dialog = dialogOf(element, 'app-form-dialog');
    type(dialog, '[id$="-amount"]', '6');
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(store.expenses().find((entry) => entry.text === 'Kerzen')?.amount).toBe(6);

    labelled(item(element, 'Kerzen'), 'Ausgabe löschen')!.click();
    fixture.detectChanges();
    labelled(dialogOf(element, 'app-confirm-dialog'), 'Löschen')!.click();
    fixture.detectChanges();
    expect(store.expenses()).toHaveLength(2);
    expect(item(element, 'Kerzen')).toBeUndefined();
  });

  it('does not accept an expense without purpose or amount', () => {
    const { fixture, store, element } = create();
    labelled(element, 'Ausgabe')!.click();
    fixture.detectChanges();
    const dialog = dialogOf(element, 'app-form-dialog');
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(squeezed(dialog.querySelector('[role="alert"]'))).toBe(
      'Bitte alle Felder mit * ausfüllen.',
    );
    expect(store.expenses()).toHaveLength(2);
  });

  it('lets only the board change the fee, the dough and the products', () => {
    const trainer = create('trainer').element;
    expect(labelled(trainer, 'Gebühr und Teig')).toBeNull();
    expect(labelled(trainer, 'Produkt')).toBeNull();
    expect(labelled(trainer, 'Kinderpunsch bearbeiten')).toBeNull();

    const { fixture, store, element } = create('admin');
    labelled(element, 'Gebühr und Teig')!.click();
    fixture.detectChanges();
    const dialog = dialogOf(element, 'app-form-dialog');
    type(dialog, '[id$="-fee"]', '50');
    type(dialog, '[id$="-batch"]', '10');
    fixture.detectChanges();
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(store.fee()).toBe(50);
    expect(store.wafflesPerBatch()).toBe(10);
    expect(fact(element, 'Standgebühr')).toBe('− 50,00 €');
  });

  it('adds a product and deletes it again, but never the two of the market', () => {
    const { fixture, store, element } = create('admin');
    expect(labelled(element, 'Belgische Waffeln bearbeiten')).toBeTruthy();
    expect(labelled(element, 'Belgische Waffeln löschen')).toBeNull();
    labelled(element, 'Produkt')!.click();
    fixture.detectChanges();
    const dialog = dialogOf(element, 'app-form-dialog');
    type(dialog, '[id$="-name"]', 'Bratwurst');
    type(dialog, '[id$="-price"]', '3.5');
    fixture.detectChanges();
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(store.products()).toHaveLength(3);
    expect(squeezed(item(element, 'Bratwurst'))).toContain('3,50 € je Stück');
    labelled(element, 'Bratwurst löschen')!.click();
    fixture.detectChanges();
    labelled(dialogOf(element, 'app-confirm-dialog'), 'Löschen')!.click();
    fixture.detectChanges();
    expect(store.products()).toHaveLength(2);
  });
});
