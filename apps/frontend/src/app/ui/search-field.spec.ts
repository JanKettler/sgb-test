import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SearchField } from './search-field';

@Component({
  imports: [SearchField],
  template: `<app-search-field placeholder="Name suchen" [(value)]="query" />`,
})
class Host {
  readonly query = signal('start');
}

describe('SearchField', () => {
  it('shows the value and the placeholder and hands typed text back', () => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector(
      'input[type="search"]',
    ) as HTMLInputElement;
    expect(input.value).toBe('start');
    expect(input.placeholder).toBe('Name suchen');
    expect(input.getAttribute('aria-label')).toBe('Suche');
    input.value = 'neu';
    input.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.query()).toBe('neu');
  });
});
