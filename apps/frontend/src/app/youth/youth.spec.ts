import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EquipmentStore } from '../equipment/equipment.store';
import { addMonthKey, monthKey, monthLabel } from '../training/training-dates';
import { CashStore } from './cash.store';
import { Youth } from './youth';
import { YouthStore } from './youth.store';

describe('Youth', () => {
  function create() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Youth);
    fixture.detectChanges();
    return fixture;
  }

  const root = (fixture: { nativeElement: unknown }) => fixture.nativeElement as HTMLElement;
  const labelled = (element: HTMLElement, label: string) =>
    element.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  const articleOf = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll<HTMLElement>('article.item')).find((entry) =>
      entry.textContent?.includes(text),
    );
  const squeezed = (element: Element | null | undefined) =>
    element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  function openTab(element: HTMLElement, name: string): void {
    const tab = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]')).find((entry) =>
      entry.textContent?.includes(name),
    );
    tab?.click();
  }

  function type(element: HTMLElement | null, value: string): void {
    if (!element) throw new Error('no field');
    (element as HTMLInputElement).value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('shows the six tabs with the numbers that need attention', () => {
    const tabs = Array.from(root(create()).querySelectorAll('[role="tab"]')).map((tab) =>
      squeezed(tab),
    );
    expect(tabs).toEqual([
      'Abzeichen 1',
      'Abrechnung Abzeichen',
      'Preise & Anforderungen',
      'Jugendkasse 2',
      'Auslagen 1',
      'Abschluss',
    ]);
  });

  it('lists the people with their badges and searches by name', () => {
    const fixture = create();
    const element = root(fixture);
    expect(element.querySelectorAll('article.item')).toHaveLength(5);
    expect(squeezed(articleOf(element, 'Mia Vogel'))).toContain('DSA Bronze · in Arbeit');
    expect(squeezed(articleOf(element, 'Mats Hartmann'))).toContain('DSA Silber · 2,00 € offen');
    expect(squeezed(articleOf(element, 'Mira Köhler'))).toContain('DLA Hai ✓');
    const search = element.querySelector('input[type="search"]') as HTMLInputElement;
    type(search, 'vogel');
    fixture.detectChanges();
    expect(element.querySelectorAll('article.item')).toHaveLength(1);
  });

  it('filters the people whose payment is still open', () => {
    const fixture = create();
    const element = root(fixture);
    const chip = Array.from(element.querySelectorAll<HTMLElement>('.chip-row .chip')).find(
      (entry) => entry.textContent?.includes('Zahlung offen'),
    );
    chip?.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('article.item')).toHaveLength(1);
    expect(element.textContent).toContain('2,00 € offen');
  });

  it('opens a person and ticks a requirement', () => {
    const fixture = create();
    const element = root(fixture);
    labelled(element, 'Mia Vogel aufklappen')?.click();
    fixture.detectChanges();
    const chips = () =>
      Array.from(articleOf(element, 'Mia Vogel')?.querySelectorAll('.chip') ?? []);
    expect(chips()).toHaveLength(5);
    expect(chips().filter((chip) => chip.getAttribute('aria-pressed') === 'true')).toHaveLength(3);
    (chips()[2] as HTMLElement).click();
    fixture.detectChanges();
    expect(chips().filter((chip) => chip.getAttribute('aria-pressed') === 'true')).toHaveLength(4);
    expect(squeezed(articleOf(element, 'Mia Vogel'))).toContain('4 von 5 Anforderungen');
  });

  it('asks before a badge counts as passed and warns about missing requirements', () => {
    const fixture = create();
    const element = root(fixture);
    labelled(element, 'Mia Vogel aufklappen')?.click();
    fixture.detectChanges();
    articleOf(element, 'Mia Vogel')
      ?.querySelector<HTMLElement>('[aria-label="Bestanden"]')
      ?.click();
    fixture.detectChanges();
    expect(squeezed(element.querySelector('app-confirm-dialog'))).toContain(
      '2 Anforderung(en) sind noch nicht abgehakt',
    );
    element.querySelector<HTMLElement>('app-confirm-dialog [aria-label="Bestanden"]')?.click();
    fixture.detectChanges();
    const record = TestBed.inject(YouthStore)
      .records()
      .find((entry) => entry.id === 'r-1');
    expect(record?.state).toBe('bestanden');
    expect(squeezed(articleOf(element, 'Mia Vogel'))).toContain('DSA Bronze · 3,00 € offen');
  });

  it('books a payment in the youth cash and takes one badge from the stock', () => {
    const fixture = create();
    const element = root(fixture);
    const stock = () =>
      TestBed.inject(EquipmentStore)
        .badges()
        .find((badge) => badge.name === 'DSA Silber')?.stock;
    const before = stock() ?? 0;
    labelled(element, 'Mats Hartmann aufklappen')?.click();
    fixture.detectChanges();
    articleOf(element, 'Mats Hartmann')
      ?.querySelector<HTMLElement>('[aria-label^="Bezahlt ("]')
      ?.click();
    fixture.detectChanges();
    expect(squeezed(element.querySelector('app-confirm-dialog'))).toContain('2,00 €');
    element.querySelector<HTMLElement>('app-confirm-dialog [aria-label="Bezahlt"]')?.click();
    fixture.detectChanges();
    expect(squeezed(articleOf(element, 'Mats Hartmann'))).toContain('DSA Silber ✓');
    expect(
      TestBed.inject(CashStore)
        .entries()
        .some((entry) => entry.ref === 'abz:r-2'),
    ).toBe(true);
    expect(stock()).toBe(before - 1);
  });

  it('refuses a person who is not a member and keeps the dialog open', () => {
    const fixture = create();
    const element = root(fixture);
    labelled(element, 'Abzeichen eintragen')?.click();
    fixture.detectChanges();
    type(element.querySelector('app-form-dialog input'), 'Niemand Unbekanntes');
    fixture.detectChanges();
    labelled(element, 'Speichern')?.click();
    fixture.detectChanges();
    expect(element.querySelector('app-form-dialog [role="alert"]')?.textContent).toContain(
      'steht nicht in der Mitgliederliste',
    );
    expect(TestBed.inject(YouthStore).records()).toHaveLength(5);
    type(element.querySelector('app-form-dialog input'), 'Tobias Lorenz');
    fixture.detectChanges();
    labelled(element, 'Speichern')?.click();
    fixture.detectChanges();
    expect(element.querySelector('app-form-dialog')).toBeNull();
    expect(TestBed.inject(YouthStore).records()).toHaveLength(6);
  });

  it('shows prices and flags the badges that run low', () => {
    const fixture = create();
    const element = root(fixture);
    openTab(element, 'Preise');
    fixture.detectChanges();
    expect(element.querySelectorAll('article.item')).toHaveLength(9);
    expect(element.querySelectorAll('.pill.is-bad')).toHaveLength(3);
    expect(squeezed(articleOf(element, 'DSA Bronze'))).toContain('3,00 €');
    labelled(element, 'DSA Bronze bearbeiten')?.click();
    fixture.detectChanges();
    type(element.querySelector('app-form-dialog input'), '4.5');
    fixture.detectChanges();
    labelled(element, 'Speichern')?.click();
    fixture.detectChanges();
    expect(squeezed(articleOf(element, 'DSA Bronze'))).toContain('4,50 €');
  });

  it('adds a new kind of badge', () => {
    const fixture = create();
    const element = root(fixture);
    openTab(element, 'Preise');
    fixture.detectChanges();
    labelled(element, 'Neues Abzeichen')?.click();
    fixture.detectChanges();
    type(element.querySelector('app-form-dialog input'), 'Freischwimmer');
    fixture.detectChanges();
    labelled(element, 'Speichern')?.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('article.item')).toHaveLength(10);
  });

  it('settles the badges of the year against the youth cash and goes back a year', () => {
    const fixture = create();
    const element = root(fixture);
    openTab(element, 'Abrechnung');
    fixture.detectChanges();
    expect(element.querySelectorAll('tbody tr')).toHaveLength(10);
    expect(squeezed(element)).toContain('stimmt überein');
    expect(element.textContent).toContain('Mira Köhler');
    labelled(element, 'Vorheriges Jahr')?.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Noch nichts.');
  });

  it('shows the balance and the bookings of the month and confirms one', () => {
    const fixture = create();
    const element = root(fixture);
    openTab(element, 'Jugendkasse');
    fixture.detectChanges();
    expect(squeezed(element.querySelector('.tile .tile-number'))).toBe('155,50 €');
    expect(element.querySelectorAll('article.item')).toHaveLength(2);
    labelled(element, 'Bestätigen')?.click();
    fixture.detectChanges();
    expect(TestBed.inject(CashStore).openEntries()).toHaveLength(1);
    labelled(element, 'Vorheriger Monat')?.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('article.item')).toHaveLength(2);
    expect(element.textContent).toContain('Kuchenverkauf Vereinsfest');
    expect(element.textContent).toContain('Kreide und Stifte');
  });

  it('books an expense with the dialog', () => {
    const fixture = create();
    const element = root(fixture);
    openTab(element, 'Jugendkasse');
    fixture.detectChanges();
    labelled(element, 'Ausgabe')?.click();
    fixture.detectChanges();
    type(element.querySelector('[id$="-amount"]'), '7.5');
    type(element.querySelector('[id$="-text"]'), 'Pokale');
    fixture.detectChanges();
    labelled(element, 'Speichern')?.click();
    fixture.detectChanges();
    const booked = TestBed.inject(CashStore)
      .entries()
      .find((entry) => entry.text === 'Pokale');
    expect(booked).toMatchObject({ kind: 'out', amount: 7.5, status: 'open', from: 'Maria' });
    expect(element.querySelectorAll('article.item')).toHaveLength(3);
  });

  it('approves and refunds an expense, which is booked in the cash', () => {
    const fixture = create();
    const element = root(fixture);
    openTab(element, 'Auslagen');
    fixture.detectChanges();
    expect(squeezed(articleOf(element, 'Pokale'))).toContain('beantragt');
    labelled(element, 'Genehmigen')?.click();
    fixture.detectChanges();
    expect(squeezed(articleOf(element, 'Pokale'))).toContain('genehmigt');
    labelled(element, 'Erstattet (als Ausgabe buchen)')?.click();
    fixture.detectChanges();
    expect(squeezed(articleOf(element, 'Pokale'))).toContain('erstattet');
    expect(TestBed.inject(CashStore).balance()).toBe(143.1);
  });

  it('closes a month once every booking is confirmed', () => {
    const fixture = create();
    const element = root(fixture);
    const store = TestBed.inject(CashStore);
    openTab(element, 'Abschluss');
    fixture.detectChanges();
    expect(element.querySelectorAll('.item-list article.item')).toHaveLength(12);
    expect(element.querySelectorAll('.pill.is-info')).toHaveLength(1);
    const last = addMonthKey(monthKey(store.today), -1);
    expect(labelled(element, `${monthLabel(monthKey(store.today))} abschließen`)).toBeNull();
    labelled(element, `${monthLabel(last)} abschließen`)?.click();
    fixture.detectChanges();
    expect(squeezed(element.querySelector('app-confirm-dialog'))).toContain(
      'Saldo am Monatsende: 155,50 €',
    );
    element.querySelector<HTMLElement>('app-confirm-dialog [aria-label="Abschließen"]')?.click();
    fixture.detectChanges();
    expect(store.closingOf(last)).toBeDefined();
    expect(labelled(element, `${monthLabel(last)} öffnen`)).not.toBeNull();
  });

  it('counts the cash and compares it with the book while typing', () => {
    const fixture = create();
    const element = root(fixture);
    openTab(element, 'Abschluss');
    fixture.detectChanges();
    labelled(element, 'Kassensturz')?.click();
    fixture.detectChanges();
    for (const [value, count] of [
      ['100', '1'],
      ['50', '1'],
      ['5', '1'],
    ]) {
      type(element.querySelector(`[id="count-${value}"]`), count);
    }
    fixture.detectChanges();
    expect(squeezed(element.querySelector('app-count-dialog'))).toContain(
      'Differenz zum Soll: -0,50 €',
    );
    type(element.querySelector('[id="count-0.5"]'), '1');
    fixture.detectChanges();
    expect(squeezed(element.querySelector('app-count-dialog'))).toContain(
      'Stimmt mit dem Kassenbuch überein.',
    );
    labelled(element, 'Speichern')?.click();
    fixture.detectChanges();
    expect(element.querySelector('app-count-dialog')).toBeNull();
    expect(TestBed.inject(CashStore).counts()).toHaveLength(1);
    expect(squeezed(element.querySelector('.pill.is-ok'))).toBe('stimmt');
  });
});
