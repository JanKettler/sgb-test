import { TestBed } from '@angular/core/testing';
import { addDays } from '../../training/training-dates';
import { TrainingStore } from '../../training/training.store';
import { MarketStore } from '../market.store';
import { NoticeTab } from './notice-tab';

describe('NoticeTab', () => {
  function create(role: 'admin' | 'trainer' | 'parent' = 'admin') {
    TestBed.resetTestingModule();
    TestBed.inject(TrainingStore).role.set(role);
    const fixture = TestBed.createComponent(NoticeTab);
    fixture.detectChanges();
    return fixture;
  }

  const root = (fixture: { nativeElement: unknown }) => fixture.nativeElement as HTMLElement;
  const squeezed = (element: Element | null | undefined) =>
    element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const labelled = (element: HTMLElement, label: string) =>
    element.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  const allLabelled = (element: HTMLElement, label: string) =>
    Array.from(element.querySelectorAll<HTMLElement>(`[aria-label="${label}"]`));
  const rowOf = (element: HTMLElement, time: string) =>
    Array.from(element.querySelectorAll('tbody tr')).find((row) =>
      squeezed(row).startsWith(time),
    ) as HTMLElement;
  const tags = (row: HTMLElement, column: number) =>
    Array.from(row.querySelectorAll('td')[column].querySelectorAll('.tag')).map((tag) =>
      squeezed(tag),
    );

  it('counts the days down to the market', () => {
    const fixture = create();
    const store = TestBed.inject(MarketStore);
    store.saturday.set(addDays(store.today, 10));
    fixture.detectChanges();
    expect(squeezed(root(fixture).querySelector('.title.is-5'))).toBe(
      'Noch 10 Tage bis zum Weihnachtsmarkt.',
    );
  });

  it('lists the lines of both days with the names, the organisers see the whole names', () => {
    const element = root(create('admin'));
    expect(element.querySelectorAll('table')).toHaveLength(2);
    const first = rowOf(element, '12:00–14:00');
    expect(tags(first, 1)).toEqual(['Lena Muster', 'Tim Probst']);
    expect(tags(first, 2)).toEqual(['Maria Beispiel']);
    expect(squeezed(rowOf(element, '16:00–18:00'))).toContain('Danach Abbau');
  });

  it('shows only the first names to everybody else, but the own name in full', () => {
    const element = root(create('parent'));
    expect(tags(rowOf(element, '12:00–14:00'), 1)).toEqual(['Lena', 'Tim']);
    expect(tags(rowOf(element, '14:00–16:00'), 1)).toEqual(['Nora', 'Sabine Beispiel']);
  });

  it('lists my shifts, with the places for the dough', () => {
    const element = root(create('parent'));
    const box = Array.from(element.querySelectorAll('.box')).find(
      (item) => squeezed(item.querySelector('h2')) === 'Meine Schichten',
    )!;
    const items = Array.from(box.querySelectorAll('.item')).map((item) => squeezed(item));
    expect(items).toHaveLength(2);
    expect(items[0]).toContain('14:00–16:00 · Unterstützung vor Ort');
    expect(items[1]).toContain('Waffelteig · Platz 2');
  });

  it('lets a parent put themselves on a line and take themselves off again', () => {
    const fixture = create('parent');
    const element = root(fixture);
    const store = TestBed.inject(MarketStore);
    const row = rowOf(element, '16:00–18:00');
    row.querySelector<HTMLElement>('[aria-label="Eintragen: Unterstützung vor Ort"]')!.click();
    fixture.detectChanges();
    expect(store.slots().find((slot) => slot.id === 's-3')!.helpers).toEqual([
      'Ole Brandt',
      'Sabine',
    ]);
    expect(tags(rowOf(element, '16:00–18:00'), 1)).toEqual(['Ole', 'Sabine']);
    const off = allLabelled(rowOf(element, '16:00–18:00'), 'Austragen: Sabine');
    expect(off).toHaveLength(1);
    off[0].click();
    fixture.detectChanges();
    expect(store.slots().find((slot) => slot.id === 's-3')!.helpers).toEqual(['Ole Brandt']);
  });

  it('does not offer a full line, and gives the others no remove button', () => {
    const fixture = create('parent');
    const element = root(fixture);
    const store = TestBed.inject(MarketStore);
    const line = store.slots().find((slot) => slot.id === 's-1')!;
    store.saveSlot({ ...line, maxHelpers: 2 });
    fixture.detectChanges();
    const row = rowOf(element, '12:00–14:00');
    expect(squeezed(row.querySelectorAll('td')[1])).toContain('2 von 2 · voll');
    expect(allLabelled(row, 'Eintragen: Unterstützung vor Ort')).toHaveLength(0);
    expect(row.querySelectorAll('.delete')).toHaveLength(0);
  });

  it('asks the organisers for the name of the person they put on a line', () => {
    const fixture = create('admin');
    const element = root(fixture);
    const store = TestBed.inject(MarketStore);
    rowOf(element, '13:00–15:00')
      .querySelector<HTMLElement>('[aria-label="Eintragen: Unterstützung vor Ort"]')!
      .click();
    fixture.detectChanges();
    const dialog = element.querySelector('app-form-dialog')!;
    expect(squeezed(dialog.querySelector('h3'))).toBe(
      'Eintragen: 13:00–15:00, Unterstützung vor Ort',
    );
    const input = dialog.querySelector<HTMLInputElement>('input')!;
    input.value = 'Nora Kranz';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    labelled(dialog as HTMLElement, 'Eintragen')!.click();
    fixture.detectChanges();
    expect(store.slots().find((slot) => slot.id === 's-5')!.helpers).toEqual(['Nora Kranz']);
    expect(element.querySelector('app-form-dialog')).toBeNull();
  });

  it('adds a line and deletes it again after a question', () => {
    const fixture = create('admin');
    const element = root(fixture);
    const store = TestBed.inject(MarketStore);
    const before = store.slots().length;
    labelled(element, 'Zeile hinzufügen')!.click();
    fixture.detectChanges();
    const dialog = element.querySelector('app-form-dialog') as HTMLElement;
    const time = dialog.querySelector<HTMLInputElement>('input')!;
    time.value = '09:00–10:00';
    time.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    labelled(dialog, 'Speichern')!.click();
    fixture.detectChanges();
    expect(store.slots()).toHaveLength(before + 1);
    const row = rowOf(element, '09:00–10:00');
    expect(row).toBeTruthy();
    row.querySelector<HTMLElement>('[aria-label="Zeile löschen"]')!.click();
    fixture.detectChanges();
    expect(store.slots()).toHaveLength(before + 1);
    labelled(element.querySelector('app-confirm-dialog') as HTMLElement, 'Löschen')!.click();
    fixture.detectChanges();
    expect(store.slots()).toHaveLength(before);
  });

  it('moves a line up and does not offer to move the first one further', () => {
    const fixture = create('admin');
    const element = root(fixture);
    const store = TestBed.inject(MarketStore);
    const first = rowOf(element, '12:00–14:00');
    expect(first.querySelector<HTMLButtonElement>('[aria-label="Zeile nach oben"]')!.disabled).toBe(
      true,
    );
    rowOf(element, '14:00–16:00')
      .querySelector<HTMLElement>('[aria-label="Zeile nach oben"]')!
      .click();
    fixture.detectChanges();
    expect(store.slotsOf('samstag').map((slot) => slot.id)).toEqual(['s-2', 's-1', 's-3']);
  });

  it('lets a parent take a free place for the dough, and an organiser add and remove places', () => {
    const parent = create('parent');
    const store = TestBed.inject(MarketStore);
    const tile = Array.from(root(parent).querySelectorAll('.tile')).find(
      (item) =>
        squeezed(item.querySelector('.tile-name')) === 'Platz 3' && squeezed(item).includes('frei'),
    ) as HTMLElement;
    labelled(tile, 'Eintragen')!.click();
    parent.detectChanges();
    expect(store.doughOf('samstag')[2].name).toBe('Sabine');

    const admin = create('admin');
    const element = root(admin);
    const adminStore = TestBed.inject(MarketStore);
    allLabelled(element, 'Platz hinzufügen')[0].click();
    admin.detectChanges();
    expect(adminStore.doughOf('samstag')).toHaveLength(6);
    allLabelled(element, 'Letzten Platz entfernen')[0].click();
    admin.detectChanges();
    expect(adminStore.doughOf('samstag')).toHaveLength(5);
  });

  it('changes the date only for the board, and only to a Saturday', () => {
    expect(labelled(root(create('trainer')), 'Datum ändern')).toBeNull();
    const fixture = create('admin');
    const element = root(fixture);
    const store = TestBed.inject(MarketStore);
    labelled(element, 'Datum ändern')!.click();
    fixture.detectChanges();
    const dialog = element.querySelector('app-form-dialog') as HTMLElement;
    const type = (digits: string) => {
      const input = dialog.querySelector<HTMLInputElement>('input')!;
      input.value = digits;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      labelled(dialog, 'Speichern')!.click();
      fixture.detectChanges();
    };
    const before = store.saturday();
    type('02112026');
    expect(squeezed(dialog.querySelector('[role="alert"]'))).toBe('Das ist kein Samstag.');
    expect(store.saturday()).toBe(before);
    type('05122026');
    expect(store.saturday()).toBe('2026-12-05');
    expect(element.querySelector('app-form-dialog')).toBeNull();
  });

  it('offers the Excel list to the organisers only', () => {
    expect(labelled(root(create('admin')), 'Helferliste als Excel')).toBeTruthy();
    expect(labelled(root(create('parent')), 'Helferliste als Excel')).toBeNull();
  });
});
