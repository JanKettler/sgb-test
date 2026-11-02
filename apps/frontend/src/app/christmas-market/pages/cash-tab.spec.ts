import { TestBed } from '@angular/core/testing';
import { addDays } from '../../training/training-dates';
import { TrainingStore } from '../../training/training.store';
import { MarketStore } from '../market.store';
import { CashTab } from './cash-tab';

describe('CashTab', () => {
  function create(role: 'admin' | 'trainer' | 'parent' = 'admin') {
    TestBed.resetTestingModule();
    TestBed.inject(TrainingStore).role.set(role);
    const store = TestBed.inject(MarketStore);
    // The market is still ahead, so the first day is the one that is shown.
    store.saturday.set(addDays(store.today, 20));
    const fixture = TestBed.createComponent(CashTab);
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
  /** The value that belongs to a label of a facts list. */
  const fact = (element: HTMLElement, label: string) =>
    squeezed(
      Array.from(element.querySelectorAll('dt')).find((term) => squeezed(term) === label)
        ?.nextElementSibling,
    );
  const numbers = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('.sale-number')).map((item) => squeezed(item));

  it('offers both days and a tile for each product', () => {
    const { element } = create();
    const chips = Array.from(element.querySelectorAll('.chip')).map((chip) => squeezed(chip));
    expect(chips).toHaveLength(2);
    expect(chips[0]).toMatch(/^Samstag, \d\d\.\d\d\.$/);
    expect(chips[1]).toMatch(/^Sonntag, \d\d\.\d\d\.$/);
    const tiles = Array.from(element.querySelectorAll('.sale'));
    expect(tiles).toHaveLength(2);
    expect(squeezed(tiles[0])).toContain('Belgische Waffeln');
    expect(squeezed(tiles[0])).toContain('2,00 € je Stück');
    expect(squeezed(tiles[1])).toContain('Kinderpunsch');
    expect(numbers(element)).toEqual(['0', '0']);
  });

  it('counts a sale with one touch and adds the money up', () => {
    const { fixture, store, element } = create();
    const plus = labelled(element, 'Belgische Waffeln bezahlt +1')!;
    plus.click();
    plus.click();
    fixture.detectChanges();
    expect(store.tally('samstag', 'waffel')).toEqual({ paid: 2, free: 0 });
    expect(numbers(element)).toEqual(['2', '0']);
    expect(fact(element, 'Verkäufe')).toBe('4,00 €');
    labelled(element, 'Belgische Waffeln bezahlt −1')!.click();
    fixture.detectChanges();
    expect(numbers(element)[0]).toBe('1');
  });

  it('cannot go below zero', () => {
    const { element } = create();
    const minus = labelled(element, 'Kinderpunsch bezahlt −1') as HTMLButtonElement;
    expect(minus.disabled).toBe(true);
    expect((labelled(element, 'Kinderpunsch gratis −1') as HTMLButtonElement).disabled).toBe(true);
  });

  it('counts the free products for the helpers without money', () => {
    const { fixture, store, element } = create();
    labelled(element, 'Kinderpunsch gratis +1')!.click();
    fixture.detectChanges();
    expect(store.tally('samstag', 'kinderpunsch')).toEqual({ paid: 0, free: 1 });
    expect(squeezed(element.querySelectorAll('.sale')[1])).toContain('Helfer (gratis): 1');
    expect(fact(element, 'Verkäufe')).toBe('0,00 €');
  });

  it('takes the last booking back', () => {
    const { fixture, store, element } = create();
    expect(labelled(element, 'Rückgängig: Belgische Waffeln bezahlt +1')).toBeNull();
    labelled(element, 'Belgische Waffeln bezahlt +1')!.click();
    fixture.detectChanges();
    const undo = labelled(element, 'Rückgängig: Belgische Waffeln bezahlt +1')!;
    undo.click();
    fixture.detectChanges();
    expect(store.tally('samstag', 'waffel').paid).toBe(0);
    expect(labelled(element, 'Rückgängig: Belgische Waffeln bezahlt +1')).toBeNull();
  });

  it('keeps the days apart', () => {
    const { fixture, store, element } = create();
    labelled(element, 'Belgische Waffeln bezahlt +1')!.click();
    element.querySelectorAll<HTMLElement>('.chip')[1].click();
    fixture.detectChanges();
    expect(numbers(element)).toEqual(['0', '0']);
    labelled(element, 'Kinderpunsch bezahlt +1')!.click();
    fixture.detectChanges();
    expect(store.tally('sonntag', 'kinderpunsch').paid).toBe(1);
    expect(store.tally('samstag', 'kinderpunsch').paid).toBe(0);
    element.querySelectorAll<HTMLElement>('.chip')[0].click();
    fixture.detectChanges();
    expect(numbers(element)).toEqual(['1', '0']);
  });

  it('takes the donations of the day', () => {
    const { fixture, store, element } = create();
    labelled(element, 'Spenden eintragen')!.click();
    fixture.detectChanges();
    const dialog = dialogOf(element, 'app-form-dialog');
    type(dialog, '[id$="-amount"]', '7.5');
    fixture.detectChanges();
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(store.donations().samstag).toBe(7.5);
    expect(fact(element, 'Spenden')).toBe('7,50 €');
    expect(element.querySelector('app-form-dialog')).toBeNull();
  });

  it('counts the money of the morning and the evening and says if the cash box is right', () => {
    const { fixture, store, element } = create();
    labelled(element, 'Belgische Waffeln bezahlt +1')!.click();
    labelled(element, 'Belgische Waffeln bezahlt +1')!.click();
    fixture.detectChanges();
    expect(squeezed(element.querySelector('[role="status"]'))).toContain('Trag das Bargeld');

    labelled(element, 'Anfangsbestand zählen')!.click();
    fixture.detectChanges();
    let dialog = dialogOf(element, 'app-count-dialog');
    type(dialog, '#count-10', '2');
    fixture.detectChanges();
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(store.sturzOf('samstag').start).toEqual({ '10': 2 });
    expect(fact(element, 'Anfangsbestand')).toBe('20,00 €');
    expect(fact(element, 'Soll in der Kasse')).toBe('24,00 €');

    labelled(element, 'Bargeld am Abend zählen')!.click();
    fixture.detectChanges();
    dialog = dialogOf(element, 'app-count-dialog');
    type(dialog, '#count-20', '1');
    type(dialog, '#count-2', '2');
    fixture.detectChanges();
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(store.resultOf('samstag').difference).toBe(0);
    expect(squeezed(element.querySelector('[role="status"]'))).toBe(
      'Die Kasse stimmt auf den Cent.',
    );
    expect(fact(element, 'Gezählt am Abend')).toBe('24,00 €');
  });

  it('names a missing amount', () => {
    const { fixture, element } = create();
    labelled(element, 'Anfangsbestand zählen')!.click();
    fixture.detectChanges();
    let dialog = dialogOf(element, 'app-count-dialog');
    type(dialog, '#count-10', '2');
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    labelled(element, 'Bargeld am Abend zählen')!.click();
    fixture.detectChanges();
    dialog = dialogOf(element, 'app-count-dialog');
    type(dialog, '#count-10', '1');
    type(dialog, '#count-5', '1');
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(squeezed(element.querySelector('[role="status"]'))).toBe('Es fehlen 5,00 €.');
  });

  it('writes down what was taken out of the cash box', () => {
    const { fixture, store, element } = create();
    expect(squeezed(element)).toContain('Es wurde nichts entnommen.');
    labelled(element, 'Entnahme')!.click();
    fixture.detectChanges();
    const dialog = dialogOf(element, 'app-form-dialog');
    type(dialog, '[id$="-amount"]', '5');
    type(dialog, '[id$="-reason"]', 'Wechselgeld geholt');
    fixture.detectChanges();
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(store.sturzOf('samstag').withdrawals).toHaveLength(1);
    expect(squeezed(element.querySelector('.item-list'))).toContain('Wechselgeld geholt');
    expect(fact(element, 'Entnahmen')).toBe('5,00 €');
    labelled(element, 'Entnahme löschen')!.click();
    fixture.detectChanges();
    expect(store.sturzOf('samstag').withdrawals).toHaveLength(0);
  });

  it('closes a day after a question and locks the buttons', () => {
    const { fixture, store, element } = create('trainer');
    labelled(element, 'Samstag abschließen')!.click();
    fixture.detectChanges();
    const dialog = dialogOf(element, 'app-confirm-dialog');
    expect(squeezed(dialog)).toContain('Der Kassensturz am Abend fehlt noch.');
    labelled(dialog, 'Trotzdem abschließen')!.click();
    fixture.detectChanges();
    expect(store.isClosed('samstag')).toBe(true);
    expect(squeezed(element.querySelector('.notification'))).toContain('Samstag wurde am');
    expect((labelled(element, 'Belgische Waffeln bezahlt +1') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(labelled(element, 'Samstag abschließen')).toBeNull();
    // Only the board may open a closed day again.
    expect(labelled(element, 'Wieder öffnen')).toBeNull();
  });

  it('lets the board open a closed day again', () => {
    const { fixture, store, element } = create('admin');
    store.closeDay('samstag');
    fixture.detectChanges();
    labelled(element, 'Wieder öffnen')!.click();
    fixture.detectChanges();
    labelled(dialogOf(element, 'app-confirm-dialog'), 'Öffnen')!.click();
    fixture.detectChanges();
    expect(store.isClosed('samstag')).toBe(false);
    expect((labelled(element, 'Belgische Waffeln bezahlt +1') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
