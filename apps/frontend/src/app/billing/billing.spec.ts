import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { fullDate } from '../training/training-dates';
import { TrainingStore } from '../training/training.store';
import { periodIndex, periodTitle } from './billing.models';
import { BillingStore } from './billing.store';
import { Billing } from './billing';

describe('Billing', () => {
  function create(role?: 'admin' | 'trainer' | 'parent') {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    if (role) TestBed.inject(TrainingStore).role.set(role);
    const fixture = TestBed.createComponent(Billing);
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

  /** The value that belongs to a label of a facts list. */
  const fact = (element: HTMLElement, label: string) =>
    squeezed(
      Array.from(element.querySelectorAll('dt')).find((term) => squeezed(term) === label)
        ?.nextElementSibling,
    );

  function openTab(element: HTMLElement, name: string): void {
    Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]'))
      .find((entry) => entry.textContent?.includes(name))
      ?.click();
  }

  function type(element: HTMLElement | null, value: string): void {
    if (!element) throw new Error('no field');
    (element as HTMLInputElement).value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /** Opens the drives of the period and year that a date lies in. */
  function showPeriodOf(
    fixture: { detectChanges: () => void },
    element: HTMLElement,
    date: string,
  ) {
    element.querySelectorAll<HTMLElement>('.chip-row .chip')[periodIndex(date)]?.click();
    fixture.detectChanges();
    const shown = Number(element.querySelector('.chip-row b')?.textContent);
    if (Number(date.slice(0, 4)) < shown) labelled(element, 'Vorheriges Jahr')?.click();
    fixture.detectChanges();
  }

  function pressed(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll<HTMLElement>('.chip-row .chip'))
      .filter((chip) => chip.getAttribute('aria-pressed') === 'true')
      .map((chip) => squeezed(chip));
  }

  describe('tabs', () => {
    it('shows the board all five tabs with what needs attention', () => {
      const tabs = Array.from(root(create()).querySelectorAll('[role="tab"]')).map((tab) =>
        squeezed(tab),
      );
      expect(tabs).toEqual(['Stunden 1', 'Fahrten 1', 'Alle Stunden 1', 'Alle Fahrten 5', 'Sätze']);
    });

    it('shows a trainer only the own hours and drives and the rates', () => {
      const tabs = Array.from(root(create('trainer')).querySelectorAll('[role="tab"]')).map((tab) =>
        squeezed(tab),
      );
      expect(tabs).toEqual(['Stunden 1', 'Fahrten 2', 'Sätze']);
    });
  });

  describe('statements', () => {
    it('lists the own statements with hours and total', () => {
      const element = root(create());
      expect(element.querySelectorAll('article.item')).toHaveLength(1);
      const text = squeezed(element.querySelector('article.item'));
      expect(text).toContain(periodTitle(TestBed.inject(BillingStore).today));
      expect(text).toContain('Entwurf');
      expect(text).toContain('3 Std. · 2 Einheiten');
      expect(text).toContain('45,00 €');
    });

    it('opens a draft in the editor and goes back', () => {
      const fixture = create();
      const element = root(fixture);
      const title = periodTitle(TestBed.inject(BillingStore).today);
      labelled(element, `${title} bearbeiten`)?.click();
      fixture.detectChanges();
      expect(element.querySelector('app-statement-editor')).not.toBeNull();
      const text = squeezed(element);
      expect(text).toContain('Übungseinheiten (2)');
      expect(text).toContain('Gesamtbetrag 45,00 €');
      labelled(element, 'Zurück')?.click();
      fixture.detectChanges();
      expect(element.querySelector('app-statement-editor')).toBeNull();
      expect(element.querySelectorAll('article.item')).toHaveLength(1);
    });

    it('starts a new draft in the editor, filled in from the profile', () => {
      const fixture = create();
      const element = root(fixture);
      labelled(element, 'Neue Abrechnung')?.click();
      fixture.detectChanges();
      expect(element.querySelector('app-statement-editor')).not.toBeNull();
      expect(squeezed(element)).toContain('Übungseinheiten (0)');
      expect(fact(element, 'Satz pro Stunde')).toBe('15,00 €');
      expect(TestBed.inject(BillingStore).mine()).toHaveLength(2);
    });

    it('changes the rate in the dialog and recalculates the total', () => {
      const fixture = create();
      const element = root(fixture);
      labelled(element, `${periodTitle(TestBed.inject(BillingStore).today)} bearbeiten`)?.click();
      fixture.detectChanges();
      labelled(element, 'Angaben bearbeiten')?.click();
      fixture.detectChanges();
      type(element.querySelector('[id$="-rate"]'), '20');
      fixture.detectChanges();
      labelled(element, 'Speichern')?.click();
      fixture.detectChanges();
      expect(element.querySelector('app-form-dialog')).toBeNull();
      expect(squeezed(element)).toContain('Gesamtbetrag 60,00 €');
    });

    it('adds a line with the dialog and deletes another', () => {
      const fixture = create();
      const element = root(fixture);
      const store = TestBed.inject(BillingStore);
      labelled(element, `${periodTitle(store.today)} bearbeiten`)?.click();
      fixture.detectChanges();
      labelled(element, 'Zeile hinzufügen')?.click();
      fixture.detectChanges();
      labelled(element, 'Speichern')?.click();
      fixture.detectChanges();
      expect(squeezed(element)).toContain('Übungseinheiten (3)');
      expect(squeezed(element)).toContain('Gesamtbetrag 60,00 €');
      const first = store.statement('s-4')!.lines[0]!;
      labelled(element, `${fullDate(first.date)} löschen`)?.click();
      fixture.detectChanges();
      expect(squeezed(element)).toContain('Übungseinheiten (2)');
      expect(store.statement('s-4')!.lines.some((line) => line.id === first.id)).toBe(false);
    });

    it('takes over the training units of a trainer', () => {
      const fixture = create('trainer');
      const element = root(fixture);
      const store = TestBed.inject(BillingStore);
      const expected = 2 + store.candidateLines(store.statement('s-2')!).length;
      labelled(element, `${periodTitle(store.today)} bearbeiten`)?.click();
      fixture.detectChanges();
      labelled(element, 'Aus Trainingsterminen')?.click();
      fixture.detectChanges();
      expect(store.statement('s-2')!.lines).toHaveLength(expected);
      expect(squeezed(element)).toContain(`Übungseinheiten (${expected})`);
    });

    it('submits a statement, locks it and takes it back', () => {
      const fixture = create();
      const element = root(fixture);
      const store = TestBed.inject(BillingStore);
      labelled(element, `${periodTitle(store.today)} bearbeiten`)?.click();
      fixture.detectChanges();
      labelled(element, 'Einreichen')?.click();
      fixture.detectChanges();
      expect(store.statement('s-4')?.state).toBe('submitted');
      expect(squeezed(element)).toContain('eingereicht');
      expect(squeezed(element)).toContain('gesperrt');
      expect(labelled(element, 'Angaben bearbeiten')).toBeNull();
      expect(labelled(element, 'Zeile hinzufügen')).toBeNull();
      labelled(element, 'Zurück zum Entwurf')?.click();
      fixture.detectChanges();
      expect(store.statement('s-4')?.state).toBe('draft');
      expect(labelled(element, 'Angaben bearbeiten')).not.toBeNull();
    });

    it('does not submit a statement without an amount', () => {
      const fixture = create();
      const element = root(fixture);
      const store = TestBed.inject(BillingStore);
      labelled(element, 'Neue Abrechnung')?.click();
      fixture.detectChanges();
      labelled(element, 'Einreichen')?.click();
      fixture.detectChanges();
      expect(store.mine()[0]?.state).toBe('draft');
      expect(element.querySelector('app-statement-editor')).not.toBeNull();
    });

    it('asks before a statement is deleted', () => {
      const fixture = create();
      const element = root(fixture);
      const store = TestBed.inject(BillingStore);
      const title = periodTitle(store.today);
      labelled(element, `${title} bearbeiten`)?.click();
      fixture.detectChanges();
      labelled(element, `${title} löschen`)?.click();
      fixture.detectChanges();
      expect(store.statement('s-4')).toBeDefined();
      element.querySelector<HTMLElement>('app-confirm-dialog [aria-label="Löschen"]')?.click();
      fixture.detectChanges();
      expect(store.statement('s-4')).toBeUndefined();
      expect(element.querySelector('app-statement-editor')).toBeNull();
      expect(element.textContent).toContain('Noch keine Abrechnung');
    });

    it('keeps the profile for the next statement', () => {
      const fixture = create();
      const element = root(fixture);
      labelled(element, 'Meine Angaben')?.click();
      fixture.detectChanges();
      type(element.querySelector('[id$="-iban"]'), 'DE02 1203 0000 0000 2020 51');
      fixture.detectChanges();
      labelled(element, 'Speichern')?.click();
      fixture.detectChanges();
      expect(TestBed.inject(BillingStore).profileOf('Maria').iban).toBe(
        'DE02 1203 0000 0000 2020 51',
      );
    });

    it('prints the statement', () => {
      const fixture = create();
      const element = root(fixture);
      const store = TestBed.inject(BillingStore);
      labelled(element, `${periodTitle(store.today)} bearbeiten`)?.click();
      fixture.detectChanges();
      const written: string[] = [];
      const popup = {
        document: {
          open: () => undefined,
          write: (html: string) => written.push(html),
          close: () => undefined,
        },
      };
      const spy = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
      try {
        labelled(element, 'Drucken')?.click();
      } finally {
        spy.mockRestore();
      }
      expect(written).toHaveLength(1);
      expect(written[0]).toContain('Trainerabrechnung');
      expect(written[0]).toContain(periodTitle(store.today));
    });
  });

  describe('all statements', () => {
    it('shows what waits for payment and filters the rest', () => {
      const fixture = create();
      const element = root(fixture);
      openTab(element, 'Alle Stunden');
      fixture.detectChanges();
      expect(pressed(element)).toEqual(['Eingereicht 1']);
      expect(element.querySelectorAll('article.item')).toHaveLength(1);
      expect(squeezed(element.querySelector('article.item'))).toContain('Anna Brandt');
      expect(squeezed(element)).toContain('Summe der Liste: 100,80 €');
      const click = (text: string) =>
        Array.from(element.querySelectorAll<HTMLElement>('.chip-row .chip'))
          .find((chip) => chip.textContent?.includes(text))
          ?.click();
      click('Alle');
      fixture.detectChanges();
      expect(element.querySelectorAll('article.item')).toHaveLength(4);
      click('Bezahlt');
      fixture.detectChanges();
      expect(element.querySelectorAll('article.item')).toHaveLength(1);
      click('Entwürfe');
      fixture.detectChanges();
      expect(element.querySelectorAll('article.item')).toHaveLength(2);
    });

    it('views the statement of somebody else and marks it as paid', () => {
      const fixture = create();
      const element = root(fixture);
      const store = TestBed.inject(BillingStore);
      openTab(element, 'Alle Stunden');
      fixture.detectChanges();
      const title = store.statement('s-3')!.title;
      labelled(element, `${title} ansehen`)?.click();
      fixture.detectChanges();
      expect(squeezed(element)).toContain('von Anna Brandt');
      expect(labelled(element, 'Angaben bearbeiten')).toBeNull();
      labelled(element, 'Als bezahlt markieren')?.click();
      fixture.detectChanges();
      expect(store.statement('s-3')).toMatchObject({ state: 'paid', paidBy: 'Maria' });
      expect(squeezed(element)).toContain('bezahlt am');
      labelled(element, 'Wieder öffnen')?.click();
      fixture.detectChanges();
      expect(store.statement('s-3')?.state).toBe('submitted');
    });
  });

  describe('drives', () => {
    it('opens on the period of today and shows what is open', () => {
      const fixture = create();
      const element = root(fixture);
      const store = TestBed.inject(BillingStore);
      openTab(element, 'Fahrten');
      fixture.detectChanges();
      expect(pressed(element)).toEqual([
        ['Jan - Mai', 'Mai - Sep', 'Sep - Dez'][periodIndex(store.today)],
      ]);
      showPeriodOf(fixture, element, store.myDrives()[0]!.date);
      expect(squeezed(element.querySelector('.box-note'))).toContain('1 Fahrt = 6,00 €');
      expect(element.querySelectorAll('article.item')).toHaveLength(1);
      expect(squeezed(element.querySelector('article.item'))).toContain('offen');
    });

    it('enters a drive and refuses a second one on the same day', () => {
      const fixture = create();
      const element = root(fixture);
      const store = TestBed.inject(BillingStore);
      openTab(element, 'Fahrten');
      fixture.detectChanges();
      labelled(element, 'Fahrt hinzufügen')?.click();
      fixture.detectChanges();
      type(element.querySelector('app-form-dialog input[placeholder^="z. B."]'), 'Testfahrt');
      fixture.detectChanges();
      labelled(element, 'Speichern')?.click();
      fixture.detectChanges();
      expect(element.querySelector('app-form-dialog')).toBeNull();
      expect(store.myDrives()).toHaveLength(2);
      expect(articleOf(element, 'Testfahrt')).toBeDefined();
      labelled(element, 'Fahrt hinzufügen')?.click();
      fixture.detectChanges();
      labelled(element, 'Speichern')?.click();
      fixture.detectChanges();
      expect(element.querySelector('app-form-dialog')).not.toBeNull();
      expect(store.myDrives()).toHaveLength(2);
    });

    it('changes and deletes a drive', () => {
      const fixture = create();
      const element = root(fixture);
      const store = TestBed.inject(BillingStore);
      openTab(element, 'Fahrten');
      fixture.detectChanges();
      store.addDrive({ owner: 'Maria', date: store.today, note: 'Alt' });
      fixture.detectChanges();
      const label = `Fahrt ${fullDate(store.today)}`;
      labelled(element, `${label} bearbeiten`)?.click();
      fixture.detectChanges();
      type(element.querySelector('app-form-dialog input[placeholder^="z. B."]'), 'Neu');
      fixture.detectChanges();
      labelled(element, 'Speichern')?.click();
      fixture.detectChanges();
      expect(articleOf(element, 'Neu')).toBeDefined();
      labelled(element, `${label} löschen`)?.click();
      fixture.detectChanges();
      element.querySelector<HTMLElement>('app-confirm-dialog [aria-label="Löschen"]')?.click();
      fixture.detectChanges();
      expect(store.myDrives()).toHaveLength(1);
    });

    it('takes over the days of the competition training that were driven', () => {
      const fixture = create();
      const element = root(fixture);
      const store = TestBed.inject(BillingStore);
      openTab(element, 'Fahrten');
      fixture.detectChanges();
      const days = store.candidateDrives(
        'Maria',
        Number(store.today.slice(0, 4)),
        periodIndex(store.today),
      );
      labelled(element, 'Aus Trainingsterminen')?.click();
      fixture.detectChanges();
      if (days.length === 0) {
        expect(element.querySelector('app-form-dialog')).toBeNull();
        return;
      }
      expect(element.querySelectorAll('app-form-dialog input[type="checkbox"]')).toHaveLength(
        days.length,
      );
      labelled(element, 'Übernehmen')?.click();
      fixture.detectChanges();
      expect(store.myDrives()).toHaveLength(1 + days.length);
    });

    it('prints the form for the open drives', () => {
      const fixture = create();
      const element = root(fixture);
      const store = TestBed.inject(BillingStore);
      openTab(element, 'Fahrten');
      fixture.detectChanges();
      showPeriodOf(fixture, element, store.myDrives()[0]!.date);
      const written: string[] = [];
      const popup = {
        document: {
          open: () => undefined,
          write: (html: string) => written.push(html),
          close: () => undefined,
        },
      };
      const spy = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
      try {
        labelled(element, 'Drucken')?.click();
      } finally {
        spy.mockRestore();
      }
      expect(written).toHaveLength(1);
      expect(written[0]).toContain('Fahrtenformular');
      expect(written[0]).toContain('Summe (1 Fahrt)');
    });

    it('asks after the Excel form whether the drives are now submitted', () => {
      const fixture = create();
      const element = root(fixture);
      const store = TestBed.inject(BillingStore);
      openTab(element, 'Fahrten');
      fixture.detectChanges();
      showPeriodOf(fixture, element, store.myDrives()[0]!.date);
      // jsdom cannot create download links; the stubs stay, as the file revokes its link later.
      URL.createObjectURL = () => 'blob:test';
      URL.revokeObjectURL = () => undefined;
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined);
      try {
        labelled(element, 'Excel')?.click();
        fixture.detectChanges();
      } finally {
        click.mockRestore();
      }
      expect(squeezed(element.querySelector('app-confirm-dialog'))).toContain('Diese 1 Fahrt');
      element
        .querySelector<HTMLElement>('app-confirm-dialog [aria-label="Als eingereicht markieren"]')
        ?.click();
      fixture.detectChanges();
      expect(store.drives().find((drive) => drive.id === 'f-7')?.state).toBe('submitted');
    });
  });

  describe('all drives', () => {
    it('groups the drives by person and shows what is open', () => {
      const fixture = create();
      const element = root(fixture);
      openTab(element, 'Alle Fahrten');
      fixture.detectChanges();
      const names = Array.from(element.querySelectorAll('article.item .item-title')).map((entry) =>
        squeezed(entry),
      );
      expect(names).toEqual(['Anna Brandt', 'Jonas Weber', 'Maria', 'Mira Köhler']);
      expect(squeezed(articleOf(element, 'Anna Brandt'))).toContain(
        '2 offen (12,00 €) · 0 abgerechnet',
      );
      expect(squeezed(articleOf(element, 'Jonas Weber'))).toContain(
        '2 offen (12,00 €) · 1 abgerechnet',
      );
    });

    it('settles the open drives of a person after asking', () => {
      const fixture = create();
      const element = root(fixture);
      const store = TestBed.inject(BillingStore);
      openTab(element, 'Alle Fahrten');
      fixture.detectChanges();
      labelled(element, 'Anna Brandt aufklappen')?.click();
      fixture.detectChanges();
      expect(articleOf(element, 'Anna Brandt')?.querySelectorAll('.sub-row')).toHaveLength(2);
      labelled(element, 'Als abgerechnet markieren: Anna Brandt')?.click();
      fixture.detectChanges();
      expect(store.drives().filter((drive) => drive.state === 'settled')).toHaveLength(1);
      element.querySelector<HTMLElement>('app-confirm-dialog [aria-label="Markieren"]')?.click();
      fixture.detectChanges();
      expect(store.drives().filter((drive) => drive.state === 'settled')).toHaveLength(3);
      expect(squeezed(articleOf(element, 'Anna Brandt'))).toContain(
        '0 offen (0,00 €) · 2 abgerechnet',
      );
    });

    it('enters a drive for a driver and deletes an open one', () => {
      const fixture = create();
      const element = root(fixture);
      const store = TestBed.inject(BillingStore);
      openTab(element, 'Alle Fahrten');
      fixture.detectChanges();
      labelled(element, 'Fahrt eintragen')?.click();
      fixture.detectChanges();
      labelled(element, 'Speichern')?.click();
      fixture.detectChanges();
      expect(squeezed(articleOf(element, 'Anna Brandt'))).toContain('3 offen (18,00 €)');
      labelled(element, 'Jonas Weber aufklappen')?.click();
      fixture.detectChanges();
      const first = store.drives().find((drive) => drive.id === 'f-1')!;
      labelled(element, `Jonas Weber: Fahrt ${fullDate(first.date)} löschen`)?.click();
      fixture.detectChanges();
      element.querySelector<HTMLElement>('app-confirm-dialog [aria-label="Löschen"]')?.click();
      fixture.detectChanges();
      expect(store.drives().some((drive) => drive.id === 'f-1')).toBe(false);
    });
  });

  describe('rates', () => {
    it('shows the rates and lets the board change them', () => {
      const fixture = create();
      const element = root(fixture);
      openTab(element, 'Sätze');
      fixture.detectChanges();
      expect(fact(element, 'Standard-Stundensatz')).toBe('12,00 €');
      expect(fact(element, 'Kilometergeld')).toBe('0,30 € pro km');
      expect(fact(element, 'Trainer C')).toBe('13,00 €');
      expect(squeezed(element)).toContain('Anna Brandt');
      labelled(element, 'Sätze bearbeiten')?.click();
      fixture.detectChanges();
      type(element.querySelector('[id$="-hourly"]'), '14');
      fixture.detectChanges();
      labelled(element, 'Speichern')?.click();
      fixture.detectChanges();
      expect(TestBed.inject(BillingStore).rates().hourly).toBe(14);
      expect(fact(element, 'Standard-Stundensatz')).toBe('14,00 €');
    });

    it('shows the rates to a trainer without the button to change them', () => {
      const fixture = create('trainer');
      const element = root(fixture);
      openTab(element, 'Sätze');
      fixture.detectChanges();
      expect(fact(element, 'Standard-Stundensatz')).toBe('12,00 €');
      expect(labelled(element, 'Sätze bearbeiten')).toBeNull();
    });
  });
});
