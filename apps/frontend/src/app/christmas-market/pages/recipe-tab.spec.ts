import { TestBed } from '@angular/core/testing';
import { TrainingStore } from '../../training/training.store';
import { MarketStore } from '../market.store';
import { RecipeTab } from './recipe-tab';

describe('RecipeTab', () => {
  function create(role: 'admin' | 'trainer' | 'parent' = 'admin') {
    TestBed.resetTestingModule();
    TestBed.inject(TrainingStore).role.set(role);
    const store = TestBed.inject(MarketStore);
    const fixture = TestBed.createComponent(RecipeTab);
    fixture.detectChanges();
    return { fixture, store, element: fixture.nativeElement as HTMLElement };
  }

  const squeezed = (element: Element | null | undefined) =>
    element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const labelled = (element: Element | null, label: string) =>
    element?.querySelector<HTMLElement>(`[aria-label="${label}"]`) ?? null;
  const type = (element: HTMLElement, selector: string, text: string) => {
    const input = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
  };
  const rows = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td')).map((cell) => squeezed(cell)),
    );

  it('shows the amounts of the recipe for its own volume', () => {
    const { element } = create();
    expect(squeezed(element.querySelector('h2'))).toBe('Winter-Kinderpunsch');
    expect(squeezed(element.querySelector('th:last-child'))).toBe('Menge für 8 Liter');
    expect(rows(element)).toEqual([
      ['Wasser wird nicht gekauft', '2 l'],
      ['Wintertee', '10 Btl.'],
      ['Orangensaft', '1 l'],
      ['Apfelsaft', '2,5 l'],
      ['Roter Traubensaft', '2,5 l'],
      ['Zimtstangen', '2 Stk.'],
      ['Glühfix', '5 Btl.'],
    ]);
  });

  it('scales the amounts to the litres that are typed', () => {
    const { fixture, element } = create();
    type(element, '#recipe-liters', '12');
    fixture.detectChanges();
    expect(squeezed(element.querySelector('th:last-child'))).toBe('Menge für 12 Liter');
    const amounts: Record<string, string> = {};
    for (const [name, amount] of rows(element)) amounts[name] = amount;
    expect(amounts['Wintertee']).toBe('15 Btl.');
    expect(amounts['Orangensaft']).toBe('1,5 l');
    expect(amounts['Zimtstangen']).toBe('3 Stk.');
  });

  it('asks for a real amount instead of showing nothing', () => {
    const { fixture, element } = create();
    type(element, '#recipe-liters', '0');
    fixture.detectChanges();
    expect(element.querySelector('table')).toBeNull();
    expect(squeezed(element)).toContain('Trag eine Menge über 0 Litern ein.');
    expect(
      (labelled(element, 'Bedarf in die Einkaufsliste übernehmen') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('shows the plan and then sets the need in the shopping list', () => {
    const { fixture, store, element } = create();
    type(element, '#recipe-liters', '12');
    fixture.detectChanges();
    labelled(element, 'Bedarf in die Einkaufsliste übernehmen')!.click();
    fixture.detectChanges();
    const dialog = element.querySelector('app-modal-dialog') as HTMLElement;
    const lines = Array.from(dialog.querySelectorAll('li')).map((line) => squeezed(line));
    expect(lines).toHaveLength(6);
    expect(lines.find((line) => line.startsWith('Wintertee'))).toContain('10 Btl. → 15 Btl.');
    expect(store.stock().find((entry) => entry.name === 'Wintertee')?.need).toBe(10);
    labelled(dialog, 'Übernehmen')!.click();
    fixture.detectChanges();
    expect(store.stock().find((entry) => entry.name === 'Wintertee')?.need).toBe(15);
    expect(store.stock().find((entry) => entry.name === 'Zimtstangen')?.need).toBe(3);
    expect(element.querySelector('app-modal-dialog')).toBeNull();
  });

  it('closes the plan without a change when the question is cancelled', () => {
    const { fixture, store, element } = create();
    type(element, '#recipe-liters', '12');
    fixture.detectChanges();
    labelled(element, 'Bedarf in die Einkaufsliste übernehmen')!.click();
    fixture.detectChanges();
    labelled(element.querySelector('app-modal-dialog'), 'Abbrechen')!.click();
    fixture.detectChanges();
    expect(store.stock().find((entry) => entry.name === 'Wintertee')?.need).toBe(10);
    expect(element.querySelector('app-modal-dialog')).toBeNull();
  });

  it('lists the preparation step by step and edits it', () => {
    const { fixture, store, element } = create();
    expect(Array.from(element.querySelectorAll('ol li')).map((line) => squeezed(line))).toEqual([
      'Tee kochen, ziehen lassen, Beutel raus.',
      'Den Rest nach und nach zugeben.',
      'Ziehen lassen.',
    ]);
    labelled(element, 'Zubereitung bearbeiten')!.click();
    fixture.detectChanges();
    const dialog = element.querySelector('app-form-dialog') as HTMLElement;
    type(dialog, '[id$="-steps"]', 'Alles mischen.\nWarm halten.');
    fixture.detectChanges();
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(store.recipe().steps).toBe('Alles mischen.\nWarm halten.');
    expect(Array.from(element.querySelectorAll('ol li')).map((line) => squeezed(line))).toEqual([
      'Alles mischen.',
      'Warm halten.',
    ]);
  });

  it('has no buttons for people who do not run the market', () => {
    const { element } = create('parent');
    expect(labelled(element, 'Zubereitung bearbeiten')).toBeNull();
    expect(labelled(element, 'Bedarf in die Einkaufsliste übernehmen')).toBeNull();
  });
});
