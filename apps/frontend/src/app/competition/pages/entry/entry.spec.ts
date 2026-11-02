import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TrainingStore } from '../../../training/training.store';
import { dateOf, eventLabel } from '../../competition.models';
import { CompetitionStore } from '../../competition.store';
import { CompetitionEntry } from './entry';

describe('CompetitionEntry', () => {
  function create(role: 'admin' | 'parent' = 'admin') {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(TrainingStore).role.set(role);
    const store = TestBed.inject(CompetitionStore);
    const person = store.actors()[0].id;
    const competition = store.visibleFor(person)[0];
    // Start from a clean answer, whatever the sample data says about this person.
    store.setEntries(competition.id, person, []);
    store.setDeclined(competition.id, person, false);
    const events = competition.events.filter((event) => event.count === 1);
    return { store, person, competition, events };
  }

  function render() {
    const fixture = TestBed.createComponent(CompetitionEntry);
    fixture.detectChanges();
    return fixture;
  }

  const squeezed = (element: Element | null | undefined) =>
    element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const card = (element: HTMLElement) => element.querySelector('article.meet') as HTMLElement;
  const button = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
      (item) => squeezed(item) === text,
    );

  it('shows a card per meet with a date block and the deadline', () => {
    const { competition } = create();
    const fixture = render();
    const first = card(fixture.nativeElement);
    expect(squeezed(first.querySelector('.name'))).toBe(competition.title);
    const date = dateOf(competition);
    expect(squeezed(first.querySelector('.date'))).toContain(String(Number(date.slice(8, 10))));
    expect(squeezed(first.querySelector('.where'))).toContain(competition.place);
    expect(squeezed(first.querySelector('.deadline'))).toContain('Meldeschluss');
  });

  it('asks for an answer while nothing is registered', () => {
    create();
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;
    expect(card(element).getAttribute('data-status')).toBe('open');
    expect(squeezed(card(element).querySelector('.pill'))).toBe('Noch keine Rückmeldung');
    expect(card(element).querySelector('.starts')).toBeNull();
    expect(button(card(element), 'Anmelden')).toBeDefined();
    expect(squeezed(element.querySelector('.subtitle'))).toContain('Noch für keinen Wettkampf');
  });

  it('lists the registered starts as chips with their entry times', () => {
    const { store, person, competition, events } = create();
    store.setEntries(competition.id, person, [
      { eventNo: events[0].no, time: '00:30,45' },
      { eventNo: events[1].no, time: '' },
    ]);
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;
    const chips = Array.from(card(element).querySelectorAll('.starts li')).map(squeezed);
    expect(chips).toEqual([
      `Wk ${events[0].no} ${eventLabel(events[0])} 00:30,45`,
      `Wk ${events[1].no} ${eventLabel(events[1])} ohne Zeit`,
    ]);
    expect(card(element).getAttribute('data-status')).toBe('registered');
    expect(squeezed(card(element).querySelector('.pill'))).toBe('2 Starts gemeldet');
    expect(squeezed(element.querySelector('.subtitle'))).toContain('gemeldet, 2 Starts');
    expect(button(card(element), 'Ändern')).toBeDefined();
  });

  it('counts a single start in the singular', () => {
    const { store, person, competition, events } = create();
    store.setEntries(competition.id, person, [{ eventNo: events[0].no, time: '' }]);
    const element = render().nativeElement as HTMLElement;
    expect(squeezed(card(element).querySelector('.pill'))).toBe('1 Start gemeldet');
  });

  it('shows an answer of "not taking part" without chips', () => {
    const { store, person, competition } = create();
    store.setDeclined(competition.id, person, true);
    const element = render().nativeElement as HTMLElement;
    expect(squeezed(card(element).querySelector('.pill'))).toBe('Abgesagt');
    expect(card(element).querySelector('.starts')).toBeNull();
    expect(squeezed(element.querySelector('.subtitle'))).toContain('1 abgesagt');
  });

  it('opens the starts with labelled buttons and hides the chips meanwhile', () => {
    const { store, person, competition, events } = create();
    store.setEntries(competition.id, person, [{ eventNo: events[0].no, time: '00:30,45' }]);
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;
    button(card(element), 'Ändern')!.click();
    fixture.detectChanges();
    const open = card(element);
    expect(open.querySelector('app-entry-form')).not.toBeNull();
    expect(open.querySelector('.starts')).toBeNull();
    expect(squeezed(open.querySelector('.count'))).toBe('1 Start gewählt');
    expect(open.querySelectorAll('.slot.is-picked')).toHaveLength(1);
    expect(button(open, 'Nicht teilnehmen')).toBeDefined();
    expect(button(open, 'Abbrechen')).toBeDefined();
    expect(button(open, 'Speichern')).toBeDefined();
    button(open, 'Zuklappen')!.click();
    fixture.detectChanges();
    expect(card(element).querySelector('app-entry-form')).toBeNull();
    expect(card(element).querySelectorAll('.starts li')).toHaveLength(1);
  });

  it('closes the card after saving and shows what was registered', () => {
    create();
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;
    button(card(element), 'Anmelden')!.click();
    fixture.detectChanges();
    card(element).querySelector<HTMLInputElement>('.slot input[type="checkbox"]')!.click();
    fixture.detectChanges();
    button(card(element), 'Speichern')!.click();
    fixture.detectChanges();
    expect(card(element).querySelector('app-entry-form')).toBeNull();
    expect(card(element).querySelectorAll('.starts li')).toHaveLength(1);
    expect(squeezed(card(element).querySelector('.pill'))).toBe('1 Start gemeldet');
  });

  it('shows the starts of the child that is chosen', () => {
    const { store } = create('parent');
    const ben = store.actors()[1].id;
    const meet = store.visibleFor(ben)[0];
    const event = meet.events.find((item) => item.count === 1)!;
    store.setEntries(meet.id, ben, [{ eventNo: event.no, time: '00:31,00' }]);
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;
    const select = element.querySelector<HTMLSelectElement>('.person-pick select')!;
    expect(select.options.length).toBe(store.actors().length);
    select.value = ben;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const shown = Array.from(element.querySelectorAll<HTMLElement>('article.meet')).find(
      (item) => squeezed(item.querySelector('.name')) === meet.title,
    )!;
    expect(Array.from(shown.querySelectorAll('.starts li')).map(squeezed)).toEqual([
      `Wk ${event.no} ${eventLabel(event)} 00:31,00`,
    ]);
  });
});
