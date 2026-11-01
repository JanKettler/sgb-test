import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TrainingStore } from '../training/training.store';
import { Equipment } from './equipment';
import { EquipmentStore } from './equipment.store';

describe('Equipment', () => {
  function create() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Equipment);
    fixture.detectChanges();
    return fixture;
  }

  const root = (fixture: { nativeElement: unknown }) => fixture.nativeElement as HTMLElement;
  const labelled = (element: HTMLElement, label: string) =>
    element.querySelector(`[aria-label="${label}"]`) as HTMLElement | null;

  function openTab(element: HTMLElement, name: string): void {
    const tab = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]')).find((entry) =>
      entry.textContent?.includes(name),
    );
    tab?.click();
  }

  it('shows the items first and marks problems with pills', () => {
    const fixture = create();
    const element = root(fixture);
    expect(element.querySelectorAll('article.item')).toHaveLength(8);
    const text = element.textContent ?? '';
    expect(text).toContain('Mindestbestand');
    expect(text).toContain('defekt');
    expect(text).toContain('überfällig');
  });

  it('shows the number of overdue loans and shopping items behind the tab names', () => {
    const fixture = create();
    const tabs = Array.from(root(fixture).querySelectorAll('[role="tab"]')).map((tab) =>
      tab.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(tabs).toEqual(['Gegenstände', 'Ausgabe & Verleih 1', 'Einkaufsliste 3', 'Abzeichen 3']);
  });

  it('searches the items', () => {
    const fixture = create();
    const element = root(fixture);
    const search = element.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'stoppuhr';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(element.querySelectorAll('article.item')).toHaveLength(1);
  });

  it('offers edit and delete only to the board, but lending to everybody who manages', () => {
    const fixture = create();
    const element = root(fixture);
    expect(labelled(element, 'Waffeleisen bearbeiten')).not.toBeNull();
    expect(labelled(element, 'Waffeleisen löschen')).not.toBeNull();
    TestBed.inject(TrainingStore).role.set('trainer');
    fixture.detectChanges();
    expect(labelled(element, 'Waffeleisen bearbeiten')).toBeNull();
    expect(labelled(element, 'Waffeleisen verleihen')).not.toBeNull();
    TestBed.inject(TrainingStore).role.set('parent');
    fixture.detectChanges();
    expect(labelled(element, 'Waffeleisen verleihen')).toBeNull();
  });

  it('opens the lending dialog and refuses somebody who is not a member', () => {
    const fixture = create();
    const element = root(fixture);
    labelled(element, 'Pull-Buoys verleihen')?.click();
    fixture.detectChanges();
    expect(element.querySelector('app-loan-dialog')).not.toBeNull();
    const who = element.querySelector('app-loan-dialog input') as HTMLInputElement;
    who.value = 'Niemand Unbekanntes';
    who.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    labelled(element, 'Ausgeben')?.click();
    fixture.detectChanges();
    expect(element.querySelector('app-loan-dialog [role="alert"]')?.textContent).toContain(
      'steht nicht in der Mitgliederliste',
    );
    const pull = TestBed.inject(EquipmentStore)
      .items()
      .find((entry) => entry.title === 'Pull-Buoys');
    expect(pull?.loans).toHaveLength(0);
  });

  it('groups the loans by person on the second tab and takes a loan back', () => {
    const fixture = create();
    const element = root(fixture);
    openTab(element, 'Ausgabe');
    fixture.detectChanges();
    expect(element.querySelectorAll('article.item')).toHaveLength(2);
    expect(element.querySelector('.item-title')?.textContent).toContain('Jonas Weber');
    labelled(element, 'Stoppuhr Nr. 2 zurücknehmen')?.click();
    fixture.detectChanges();
    expect(TestBed.inject(EquipmentStore).overdueCount()).toBe(0);
    expect(element.querySelectorAll('article.item')).toHaveLength(1);
    expect(element.querySelector('.item-title')?.textContent).toContain('Mia Vogel');
  });

  it('asks before an item is marked as bought and then raises the stock', () => {
    const fixture = create();
    const element = root(fixture);
    openTab(element, 'Einkaufsliste');
    fixture.detectChanges();
    expect(element.querySelectorAll('article.item')).toHaveLength(3);
    const first = Array.from(element.querySelectorAll<HTMLElement>('article.item')).find((entry) =>
      entry.textContent?.includes('Medaillen'),
    );
    first?.querySelector<HTMLElement>('button.is-success')?.click();
    fixture.detectChanges();
    expect(element.querySelector('app-confirm-dialog')?.textContent).toContain('auf 30 Stück');
    (element.querySelector('app-confirm-dialog button.is-success') as HTMLElement).click();
    fixture.detectChanges();
    expect(element.querySelectorAll('article.item')).toHaveLength(2);
  });

  it('shows the badge stock and flags the ones that run low', () => {
    const fixture = create();
    const element = root(fixture);
    openTab(element, 'Abzeichen');
    fixture.detectChanges();
    expect(element.querySelectorAll('.tile')).toHaveLength(9);
    expect(element.querySelectorAll('.tile.is-bad')).toHaveLength(3);
    expect(element.textContent).toContain('Nachbestellen');
  });
});
