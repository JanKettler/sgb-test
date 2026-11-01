import { TestBed } from '@angular/core/testing';
import { TrainingStore } from '../training/training.store';
import { Documents } from './documents';

describe('Documents', () => {
  function create() {
    const fixture = TestBed.createComponent(Documents);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return { fixture, root, items: () => root.querySelectorAll('.item') };
  }

  it('lists the documents and filters by area', () => {
    const { fixture, root, items } = create();
    const all = items().length;
    expect(all).toBeGreaterThan(5);
    const chip = Array.from(root.querySelectorAll<HTMLButtonElement>('.chip')).find((element) =>
      element.textContent?.includes('Finanzen'),
    )!;
    chip.click();
    fixture.detectChanges();
    expect(items().length).toBeGreaterThan(0);
    expect(items().length).toBeLessThan(all);
  });

  it('searches in title and description', () => {
    const { fixture, root, items } = create();
    const search = root.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'satzung';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(items()).toHaveLength(1);
    expect(items()[0].textContent).toContain('Satzung');
  });

  it('shows the buttons for changes to the board only', () => {
    const { fixture, root } = create();
    expect(root.querySelector('button[aria-label="Dokument hinzufügen"]')).not.toBeNull();
    TestBed.inject(TrainingStore).role.set('trainer');
    fixture.detectChanges();
    expect(root.querySelector('button[aria-label="Dokument hinzufügen"]')).toBeNull();
  });
});
