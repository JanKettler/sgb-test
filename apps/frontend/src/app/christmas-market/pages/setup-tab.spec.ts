import { TestBed } from '@angular/core/testing';
import { TrainingStore } from '../../training/training.store';
import { MarketStore } from '../market.store';
import { SetupTab } from './setup-tab';

describe('SetupTab', () => {
  function create(role: 'admin' | 'trainer' | 'parent' = 'admin') {
    TestBed.resetTestingModule();
    TestBed.inject(TrainingStore).role.set(role);
    const store = TestBed.inject(MarketStore);
    const fixture = TestBed.createComponent(SetupTab);
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
  const boxOf = (element: HTMLElement, heading: string) =>
    Array.from(element.querySelectorAll('.box')).find(
      (box) => squeezed(box.querySelector('h2')) === heading,
    ) as HTMLElement;
  const titles = (box: HTMLElement) =>
    Array.from(box.querySelectorAll('.item-title')).map((title) => squeezed(title));

  it('lists the steps of the setup with their times', () => {
    const { element } = create();
    const setup = boxOf(element, 'Aufbau');
    expect(titles(setup)).toHaveLength(5);
    expect(titles(setup)[0]).toBe('09:30 Hütte aufschließen');
    expect(squeezed(setup.querySelector('.sub'))).toBe('0 von 5 erledigt');
  });

  it('ticks a step off and counts what is done', () => {
    const { fixture, store, element } = create();
    const setup = boxOf(element, 'Aufbau');
    setup.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    fixture.detectChanges();
    expect(store.stepsOf('aufbau')[0].done).toBe(true);
    expect(squeezed(setup.querySelector('.sub'))).toBe('1 von 5 erledigt');
    expect(setup.querySelector('.item-title.is-struck')).toBeTruthy();
  });

  it('offers a suggestion for the removal as long as there is none', () => {
    const { fixture, store, element } = create();
    const removal = boxOf(element, 'Abbau');
    expect(squeezed(removal)).toContain('Hier steht noch nichts.');
    labelled(removal, 'Vorschlag für den Abbau einfügen')!.click();
    fixture.detectChanges();
    expect(store.stepsOf('abbau')).toHaveLength(6);
    expect(labelled(boxOf(element, 'Abbau'), 'Vorschlag für den Abbau einfügen')).toBeNull();
    expect(squeezed(boxOf(element, 'Abbau').querySelector('.sub'))).toBe('0 von 6 erledigt');
  });

  it('adds a step, moves it up and deletes it after a question', () => {
    const { fixture, store, element } = create();
    labelled(element, 'Schritt für den Aufbau')!.click();
    fixture.detectChanges();
    const dialog = element.querySelector('app-form-dialog') as HTMLElement;
    type(dialog, '[id$="-title"]', 'Tische abwischen');
    fixture.detectChanges();
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(store.stepsOf('aufbau')).toHaveLength(6);
    expect(titles(boxOf(element, 'Aufbau')).at(-1)).toBe('Tische abwischen');

    const items = Array.from(boxOf(element, 'Aufbau').querySelectorAll('.item'));
    labelled(items.at(-1)!, 'Schritt nach oben')!.click();
    fixture.detectChanges();
    expect(titles(boxOf(element, 'Aufbau')).at(-2)).toBe('Tische abwischen');
    const last = Array.from(boxOf(element, 'Aufbau').querySelectorAll('.item')).at(-1)!;
    expect((labelled(last, 'Schritt nach unten') as HTMLButtonElement).disabled).toBe(true);

    const moved = Array.from(boxOf(element, 'Aufbau').querySelectorAll('.item')).at(-2)!;
    labelled(moved, 'Schritt löschen')!.click();
    fixture.detectChanges();
    labelled(element.querySelector('app-confirm-dialog'), 'Löschen')!.click();
    fixture.detectChanges();
    expect(store.stepsOf('aufbau')).toHaveLength(5);
  });

  it('does not accept a step without a description', () => {
    const { fixture, store, element } = create();
    labelled(element, 'Schritt für den Abbau')!.click();
    fixture.detectChanges();
    const dialog = element.querySelector('app-form-dialog') as HTMLElement;
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(squeezed(dialog.querySelector('[role="alert"]'))).toBe(
      'Bitte alle Felder mit * ausfüllen.',
    );
    expect(store.stepsOf('abbau')).toHaveLength(0);
  });

  it('edits a step, with the time and the description', () => {
    const { fixture, store, element } = create();
    const first = boxOf(element, 'Aufbau').querySelector('.item') as HTMLElement;
    labelled(first, 'Schritt bearbeiten')!.click();
    fixture.detectChanges();
    const dialog = element.querySelector('app-form-dialog') as HTMLElement;
    type(dialog, '[id$="-title"]', 'Hütte öffnen');
    fixture.detectChanges();
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(store.stepsOf('aufbau')[0]).toMatchObject({ title: 'Hütte öffnen', time: '09:30' });
  });

  it('keeps the notes for the helpers and lets the organisers change them', () => {
    const { fixture, store, element } = create();
    const notes = boxOf(element, 'Hinweise');
    expect(titles(notes)).toEqual(['Strom', 'Hygiene']);
    labelled(notes, 'Hinweis')!.click();
    fixture.detectChanges();
    const dialog = element.querySelector('app-form-dialog') as HTMLElement;
    type(dialog, '[id$="-title"]', 'Kasse');
    type(dialog, '[id$="-text"]', 'Die Kasse bleibt nie allein.');
    fixture.detectChanges();
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(store.notes()).toHaveLength(3);
    expect(titles(boxOf(element, 'Hinweise'))).toEqual(['Strom', 'Hygiene', 'Kasse']);

    const added = Array.from(boxOf(element, 'Hinweise').querySelectorAll('.item')).at(-1)!;
    labelled(added, 'Hinweis löschen')!.click();
    fixture.detectChanges();
    labelled(element.querySelector('app-confirm-dialog'), 'Löschen')!.click();
    fixture.detectChanges();
    expect(store.notes()).toHaveLength(2);
  });

  it('has no buttons for people who do not run the market', () => {
    const { element } = create('parent');
    expect(labelled(element, 'Schritt für den Aufbau')).toBeNull();
    expect(labelled(element, 'Hinweis')).toBeNull();
    expect(element.querySelectorAll('.item-actions')).toHaveLength(0);
  });
});
