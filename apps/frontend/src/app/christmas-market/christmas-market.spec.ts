import { TestBed } from '@angular/core/testing';
import { TrainingStore } from '../training/training.store';
import { ChristmasMarket } from './christmas-market';

describe('ChristmasMarket', () => {
  function create(role: 'admin' | 'trainer' | 'parent' = 'admin') {
    TestBed.resetTestingModule();
    TestBed.inject(TrainingStore).role.set(role);
    const fixture = TestBed.createComponent(ChristmasMarket);
    fixture.detectChanges();
    return fixture;
  }

  const root = (fixture: { nativeElement: unknown }) => fixture.nativeElement as HTMLElement;
  const squeezed = (element: Element | null | undefined) =>
    element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const tabs = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('[role="tab"]')).map((tab) => squeezed(tab));

  it('shows the title with the dates of both days', () => {
    const element = root(create());
    expect(squeezed(element.querySelector('h2'))).toBe('Weihnachtsmarkt');
    expect(squeezed(element.querySelector('.subtitle'))).toMatch(
      /^Samstag, \d\d\.\d\d\.\d{4} und Sonntag, \d\d\.\d\d\.\d{4}$/,
    );
  });

  it('gives the organisers all six pages and everybody else only the helper lists', () => {
    expect(tabs(root(create('admin')))).toHaveLength(6);
    expect(tabs(root(create('trainer')))).toHaveLength(6);
    expect(tabs(root(create('parent')))).toEqual(['Aushang']);
  });

  it('opens the helper lists first and switches the page with the tabs', () => {
    const fixture = create();
    const element = root(fixture);
    expect(element.querySelector('app-market-notice')).toBeTruthy();
    expect(element.querySelector('app-market-cash')).toBeNull();
    const cash = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]')).find(
      (tab) => squeezed(tab) === 'Kasse',
    )!;
    cash.click();
    fixture.detectChanges();
    expect(element.querySelector('app-market-cash')).toBeTruthy();
    expect(element.querySelector('app-market-notice')).toBeNull();
  });
});
