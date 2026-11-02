import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TrainingStore } from '../../../training/training.store';
import { eventLabel } from '../../competition.models';
import { CompetitionStore } from '../../competition.store';
import { CompetitionView } from './competition-view';

describe('CompetitionView', () => {
  function create(id: string, role: 'admin' | 'trainer' | 'parent' = 'admin') {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id }) } },
        },
      ],
    });
    TestBed.inject(TrainingStore).role.set(role);
    const fixture = TestBed.createComponent(CompetitionView);
    fixture.detectChanges();
    return fixture;
  }

  const root = (fixture: { nativeElement: unknown }) => fixture.nativeElement as HTMLElement;
  const labelled = (element: HTMLElement, label: string) =>
    element.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  const squeezed = (element: Element | null | undefined) =>
    element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  /** The value that belongs to a label of a facts list. */
  const fact = (element: HTMLElement, label: string) =>
    squeezed(
      Array.from(element.querySelectorAll('dt')).find((term) => squeezed(term) === label)
        ?.nextElementSibling,
    );

  it('shows the title, the place and the facts of the meet', () => {
    const element = root(create('c-1'));
    expect(squeezed(element.querySelector('h2'))).toBe('Hunte-Pokal');
    expect(squeezed(element.querySelector('.subtitle'))).toContain('Oldenburg');
    expect(fact(element, 'Bahn')).toBe('Kurzbahn (25 m)');
    expect(fact(element, 'Zeitnahme')).toBe('Handzeit');
    expect(fact(element, 'Meldeschluss')).toContain('23:59 Uhr');
    expect(fact(element, 'Anmeldung im Portal')).toBe('Alle');
    expect(fact(element, 'Wettkampfstätte')).toBe(
      'Hallenbad Oldenburg, Badstraße 1, 26121 Oldenburg',
    );
    expect(fact(element, 'Meldegeld')).toBe('bisher 63,00 €');
  });

  it('leaves out the facts without a value', () => {
    const element = root(create('c-1'));
    const labels = Array.from(element.querySelectorAll('dt')).map((term) => squeezed(term));
    expect(labels).toContain('Kontakt');
    expect(labels).not.toContain('Hinweis');
    expect(labels).not.toContain('Gesendet');
  });

  it('lists the sections and the events', () => {
    const fixture = create('c-1');
    const element = root(fixture);
    const store = TestBed.inject(CompetitionStore);
    const meet = store.competition('c-1')!;
    const [sections, events] = Array.from(element.querySelectorAll('table'));
    const sectionRows = Array.from(sections.querySelectorAll('tbody tr'));
    expect(sectionRows).toHaveLength(2);
    expect(squeezed(sectionRows[0])).toContain('09:30');
    expect(squeezed(sectionRows[1])).toContain('nach Abs. davor');
    expect(squeezed(sectionRows[0])).not.toContain('nach Abs. davor');
    const eventRows = Array.from(events.querySelectorAll('tbody tr'));
    expect(eventRows).toHaveLength(meet.events.length);
    expect(squeezed(eventRows[0])).toContain(eventLabel(meet.events[0]));
  });

  it('lists every swimmer with the starts, and the relay team with its members', () => {
    const fixture = create('c-1');
    const element = root(fixture);
    const store = TestBed.inject(CompetitionStore);
    const meet = store.competition('c-1')!;
    const entries = Array.from(element.querySelectorAll('.entry-list li'));
    const starters = store.starters(meet);
    expect(entries).toHaveLength(starters.length + 1);
    const texts = entries.map((item) => squeezed(item));
    const missing = starters.filter((row) => !texts.some((text) => text.includes(row.name)));
    expect(missing).toEqual([]);
    expect(texts.slice(0, starters.length).every((text) => text.includes('Wk '))).toBe(true);
    const relay = entries.find((item) => squeezed(item).includes('1. Mannschaft'));
    expect(squeezed(relay)).toContain(store.nameOf('p-mats'));
    expect(squeezed(relay)).toContain(store.nameOf('p-sophie'));
  });

  it('counts the judges against the number that is needed', () => {
    const fixture = create('c-1');
    const store = TestBed.inject(CompetitionStore);
    const meet = store.competition('c-1')!;
    store.save({
      ...meet,
      officials: { 1: ['p-mats'] },
      coaches: { 1: ['p-emil'] },
      plan: { ...meet.plan, judges: { 1: 2 } },
    });
    fixture.detectChanges();
    const element = root(fixture);
    const section = squeezed(
      Array.from(element.querySelectorAll('dt')).find((term) => squeezed(term) === 'Abschnitt 1')
        ?.nextElementSibling,
    );
    expect(section).toContain(store.nameOf('p-mats'));
    expect(section).toContain('1 von 2');
    expect(section).toContain(store.nameOf('p-emil'));
    const second = squeezed(
      Array.from(element.querySelectorAll('dt')).find((term) => squeezed(term) === 'Abschnitt 2')
        ?.nextElementSibling,
    );
    expect(second).toContain('niemand eingetragen');
  });

  it('offers the edit link only to those who may change the meet', () => {
    expect(labelled(root(create('c-1', 'admin')), 'Bearbeiten')?.getAttribute('href')).toBe(
      '/wettkampf/wettkaempfe/c-1',
    );
    expect(labelled(root(create('c-1', 'trainer')), 'Bearbeiten')).not.toBeNull();
    const parent = root(create('c-1', 'parent'));
    expect(labelled(parent, 'Bearbeiten')).toBeNull();
    expect(labelled(parent, 'Zur Liste')?.getAttribute('href')).toBe('/wettkampf/wettkaempfe');
  });

  it('says so when the meet does not exist', () => {
    const element = root(create('gibt-es-nicht'));
    expect(element.querySelector('h2')).toBeNull();
    expect(squeezed(element)).toContain('Diesen Wettkampf gibt es nicht.');
    expect(labelled(element, 'Zur Liste')).not.toBeNull();
  });
});
