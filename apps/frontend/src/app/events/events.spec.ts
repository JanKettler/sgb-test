import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StartStore } from '../start/start.store';
import { TasksStore } from '../tasks/tasks.store';
import { TrainingStore } from '../training/training.store';
import { Events } from './events';
import { EventsStore } from './events.store';

describe('Events', () => {
  function create() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Events);
    fixture.detectChanges();
    return fixture;
  }

  const root = (fixture: { nativeElement: unknown }) => fixture.nativeElement as HTMLElement;
  const labelled = (element: HTMLElement, label: string) =>
    element.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  const market = () =>
    TestBed.inject(EventsStore)
      .events()
      .find((entry) => entry.title === 'Weihnachtsmarkt');

  it('lists the events, the open ones first, with the progress of the checklist', () => {
    const element = root(create());
    const titles = Array.from(element.querySelectorAll('article.item .item-title')).map((title) =>
      title.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(titles).toEqual([
      'Weihnachtsmarkt Geplant 3/21',
      'Jahreshauptversammlung Geplant 0/10',
      'Vereinsschwimmfest Abgeschlossen 13/13',
    ]);
    expect(element.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });

  it('opens an event and shows the checklist by category', () => {
    const fixture = create();
    const element = root(fixture);
    labelled(element, 'Weihnachtsmarkt aufklappen')?.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('input[type="checkbox"]')).toHaveLength(21);
    expect(element.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(3);
    const headings = Array.from(element.querySelectorAll('.item-heading')).map((entry) =>
      entry.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(headings).toContain('Vorher (3/15)');
    expect(headings).toContain('Am Tag (0/3)');
    expect(headings).toContain('Danach (0/3)');
    expect(headings).toContain('Helfer (2)');
  });

  it('ticks a point off for everybody who manages the club', () => {
    const fixture = create();
    const element = root(fixture);
    labelled(element, 'Weihnachtsmarkt aufklappen')?.click();
    fixture.detectChanges();
    TestBed.inject(TrainingStore).role.set('trainer');
    fixture.detectChanges();
    const open = element.querySelector<HTMLInputElement>('input[type="checkbox"]:not(:checked)');
    open?.click();
    fixture.detectChanges();
    expect(market()?.checklist.filter((point) => point.done)).toHaveLength(4);
    expect(market()?.checklist.find((point) => point.doneBy === 'Jonas')).toBeDefined();
  });

  it('shows the templates only to the board', () => {
    const fixture = create();
    const element = root(fixture);
    const tabs = () =>
      Array.from(element.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent?.trim());
    expect(tabs()).toEqual(['Veranstaltungen', 'Vorlagen']);
    TestBed.inject(TrainingStore).role.set('trainer');
    fixture.detectChanges();
    expect(tabs()).toEqual(['Veranstaltungen']);
    expect(labelled(element, 'Weihnachtsmarkt bearbeiten')).toBeNull();
  });

  it('signs the user up as a helper', () => {
    const fixture = create();
    const element = root(fixture);
    labelled(element, 'Weihnachtsmarkt aufklappen')?.click();
    fixture.detectChanges();
    labelled(element, 'Ich helfe')?.click();
    fixture.detectChanges();
    const name = element.querySelector<HTMLInputElement>('app-form-dialog [id$="-name"]');
    expect(name?.value).toBe('Maria');
    labelled(element, 'Eintragen')?.click();
    fixture.detectChanges();
    expect(market()?.helpers.map((helper) => helper.name)).toContain('Maria');
    expect(element.querySelector('app-form-dialog')).toBeNull();
  });

  it('turns the open points into tasks after a question', () => {
    const fixture = create();
    const element = root(fixture);
    const tasks = TestBed.inject(TasksStore);
    const before = tasks.tasks().length;
    labelled(element, 'Weihnachtsmarkt aufklappen')?.click();
    fixture.detectChanges();
    labelled(element, 'Offene Punkte als Aufgaben')?.click();
    fixture.detectChanges();
    expect(element.querySelector('app-confirm-dialog')?.textContent).toContain('18 offene Punkte');
    labelled(element, 'Anlegen')?.click();
    fixture.detectChanges();
    expect(tasks.tasks()).toHaveLength(before + 18);
    expect(tasks.tasks().at(-1)?.link).toBe('/veranstaltungen');
  });

  it('adds an event and shows it on the start page', () => {
    const fixture = create();
    const element = root(fixture);
    labelled(element, 'Neue Veranstaltung')?.click();
    fixture.detectChanges();
    const title = element.querySelector<HTMLInputElement>('app-form-dialog [id$="-title"]');
    if (title) {
      title.value = 'Sommerfest';
      title.dispatchEvent(new Event('input', { bubbles: true }));
    }
    fixture.detectChanges();
    labelled(element, 'Speichern')?.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('article.item')).toHaveLength(4);
    const start = TestBed.inject(StartStore);
    expect(start.events().map((entry) => entry.title)).toContain('Sommerfest');
    const planned = start.events().find((entry) => entry.title === 'Weihnachtsmarkt');
    expect(planned).toMatchObject({ icon: 'tree', route: '/veranstaltungen' });
  });

  it('searches the events', () => {
    const fixture = create();
    const element = root(fixture);
    const search = element.querySelector<HTMLInputElement>('input[type="search"]');
    if (search) {
      search.value = 'versammlung';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
    fixture.detectChanges();
    expect(element.querySelectorAll('article.item')).toHaveLength(1);
  });

  it('lists the templates with their points and the days', () => {
    const fixture = create();
    const element = root(fixture);
    Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]'))
      .find((tab) => tab.textContent?.includes('Vorlagen'))
      ?.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('article.item')).toHaveLength(5);
    labelled(element, 'Vereinsfeier / Ausflug aufklappen')?.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Termin und Ort festlegen');
    expect(element.textContent).toContain('-60 Tg.');
    expect(element.textContent).toContain('+7 Tg.');
  });
});
