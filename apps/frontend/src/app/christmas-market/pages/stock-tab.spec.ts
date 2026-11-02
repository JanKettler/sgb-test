import { TestBed } from '@angular/core/testing';
import { TrainingStore } from '../../training/training.store';
import { MarketStore } from '../market.store';
import { StockTab } from './stock-tab';

describe('StockTab', () => {
  function create(role: 'admin' | 'trainer' | 'parent' = 'admin') {
    TestBed.resetTestingModule();
    TestBed.inject(TrainingStore).role.set(role);
    const store = TestBed.inject(MarketStore);
    const fixture = TestBed.createComponent(StockTab);
    fixture.detectChanges();
    return { fixture, store, element: fixture.nativeElement as HTMLElement };
  }

  const squeezed = (element: Element | null | undefined) =>
    element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const labelled = (element: Element | null, label: string) =>
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
  const headings = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('h3')).map((heading) => squeezed(heading));
  const rowOf = (element: HTMLElement, name: string) =>
    Array.from(element.querySelectorAll('tbody tr')).find(
      (row) => squeezed(row.querySelector('td.is-left')) === name,
    ) as HTMLElement;
  const chip = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll<HTMLElement>('.chip')).find((entry) =>
      squeezed(entry).startsWith(text),
    )!;

  it('groups the shopping list by store and adds up the cost of each store', () => {
    const { element } = create();
    expect(headings(element)).toEqual(['E-Center', 'Kruber', 'Lidl', 'Metro', 'REWE']);
    const kruber = Array.from(element.querySelectorAll('.box')).find(
      (box) => squeezed(box.querySelector('h3')) === 'Kruber',
    )!;
    expect(squeezed(kruber.querySelector('.pill'))).toBe('23,02 €');
    expect(Array.from(kruber.querySelectorAll('td.is-left')).map((cell) => squeezed(cell))).toEqual(
      ['Vanillezucker', 'Weizenmehl', 'Zucker'],
    );
  });

  it('shows what is missing, the packs to buy and the price of an article', () => {
    const { element } = create();
    const cells = Array.from(rowOf(element, 'Weizenmehl').querySelectorAll('td')).map((cell) =>
      squeezed(cell),
    );
    // bought, article, need, stock (input), missing, packs, price, sum, actions
    expect(cells[1]).toBe('Weizenmehl');
    expect(cells[2]).toBe('12 kg');
    expect(cells[4]).toBe('10 kg');
    expect(cells[5]).toBe('10 × 1 kg');
    expect(cells[6]).toBe('1,29 €');
    expect(cells[7]).toBe('12,90 €');
  });

  it('adds up the articles, what is still to pay and what is paid', () => {
    const { fixture, store, element } = create();
    const totals = store.totals();
    expect(fact(element, 'Artikel auf der Liste')).toBe(
      `${totals.articles}, davon ${totals.missing} noch zu kaufen`,
    );
    expect(fact(element, 'Schon gekauft')).toBe('0,00 €');
    (labelled(rowOf(element, 'Weizenmehl'), 'Weizenmehl gekauft') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(store.stock().find((entry) => entry.id === 'i-1')).toMatchObject({
      bought: true,
      boughtPacks: 10,
    });
    expect(fact(element, 'Schon gekauft')).toBe('12,90 €');
    expect(squeezed(rowOf(element, 'Weizenmehl').querySelectorAll('td')[4])).toBe('gekauft');
  });

  it('takes the stock of an article and then needs less', () => {
    const { fixture, store, element } = create();
    const input = labelled(rowOf(element, 'Weizenmehl'), 'Weizenmehl im Lager') as HTMLInputElement;
    input.value = '12';
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(store.stock().find((entry) => entry.id === 'i-1')?.stock).toBe(12);
    expect(squeezed(rowOf(element, 'Weizenmehl').querySelectorAll('td')[4])).toBe('ok');
  });

  it('takes an article off the shopping list', () => {
    const { fixture, store, element } = create();
    labelled(rowOf(element, 'Wintertee'), 'Wintertee von der Liste nehmen')!.click();
    fixture.detectChanges();
    expect(store.shopping().some((entry) => entry.name === 'Wintertee')).toBe(false);
    expect(rowOf(element, 'Wintertee')).toBeUndefined();
  });

  it('shows the inventory by category and changes the status of an article', () => {
    const { fixture, store, element } = create();
    chip(element, 'Inventar').click();
    fixture.detectChanges();
    expect(headings(element)).toEqual(['Zutaten', 'Technik', 'Verpackung', 'Orga']);
    const select = labelled(
      rowOf(element, 'Waffeleisen'),
      'Waffeleisen Status',
    ) as HTMLSelectElement;
    select.value = 'Verteilt';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(store.stock().find((entry) => entry.id === 'i-15')?.status).toBe('Verteilt');
  });

  it('puts a piece of equipment on the shopping list by hand', () => {
    const { fixture, store, element } = create();
    chip(element, 'Inventar').click();
    fixture.detectChanges();
    labelled(rowOf(element, 'Wasserkocher'), 'Wasserkocher auf die Liste setzen')!.click();
    fixture.detectChanges();
    expect(store.shopping().some((entry) => entry.name === 'Wasserkocher')).toBe(true);
    expect(
      labelled(rowOf(element, 'Wasserkocher'), 'Wasserkocher von der Liste nehmen'),
    ).toBeTruthy();
  });

  it('adds an article and deletes it after a question', () => {
    const { fixture, store, element } = create();
    const before = store.stock().length;
    labelled(element, 'Artikel')!.click();
    fixture.detectChanges();
    const dialog = dialogOf(element, 'app-form-dialog');
    type(dialog, '[id$="-name"]', 'Kerzen');
    type(dialog, '[id$="-category"]', 'Technik');
    type(dialog, '[id$="-need"]', '20');
    type(dialog, '[id$="-unit"]', 'Stk.');
    fixture.detectChanges();
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(store.stock()).toHaveLength(before + 1);
    const added = store.stock().find((entry) => entry.name === 'Kerzen')!;
    // Equipment is not bought, so the category decides and no choice is kept.
    expect(added).toMatchObject({ category: 'Technik', need: 20, unit: 'Stk.', onList: null });

    chip(element, 'Inventar').click();
    fixture.detectChanges();
    labelled(rowOf(element, 'Kerzen'), 'Kerzen löschen')!.click();
    fixture.detectChanges();
    labelled(dialogOf(element, 'app-confirm-dialog'), 'Löschen')!.click();
    fixture.detectChanges();
    expect(store.stock()).toHaveLength(before);
  });

  it('keeps the choice when an article of another category is put on the list', () => {
    const { fixture, store, element } = create();
    labelled(element, 'Artikel')!.click();
    fixture.detectChanges();
    const dialog = dialogOf(element, 'app-form-dialog');
    type(dialog, '[id$="-name"]', 'Kerzen');
    type(dialog, '[id$="-category"]', 'Technik');
    const choice = dialog.querySelector<HTMLSelectElement>('[id$="-onList"]')!;
    choice.value = 'yes';
    choice.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(store.stock().find((entry) => entry.name === 'Kerzen')?.onList).toBe(true);
    expect(rowOf(element, 'Kerzen')).toBeTruthy();
  });

  it('does not accept an article without a name', () => {
    const { fixture, store, element } = create();
    const before = store.stock().length;
    labelled(element, 'Artikel')!.click();
    fixture.detectChanges();
    const dialog = dialogOf(element, 'app-form-dialog');
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(squeezed(dialog.querySelector('[role="alert"]'))).toBe(
      'Bitte alle Felder mit * ausfüllen.',
    );
    expect(store.stock()).toHaveLength(before);
  });
});
