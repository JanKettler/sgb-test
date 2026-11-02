import { TestBed } from '@angular/core/testing';
import { addDays } from '../training/training-dates';
import { emptyEvent } from './events.models';
import { EventsStore } from './events.store';

describe('EventsStore', () => {
  function create() {
    TestBed.resetTestingModule();
    return TestBed.inject(EventsStore);
  }

  const event = (store: EventsStore, title: string) => {
    const found = store.events().find((entry) => entry.title === title);
    if (!found) throw new Error(`no event ${title}`);
    return found;
  };

  const template = (store: EventsStore, title: string) => {
    const found = store.templates().find((entry) => entry.title.startsWith(title));
    if (!found) throw new Error(`no template ${title}`);
    return found;
  };

  it('shows open events by date first, finished events last', () => {
    const store = create();
    expect(store.sorted().map((entry) => entry.title)).toEqual([
      'Weihnachtsmarkt',
      'Jahreshauptversammlung',
      'Vereinsschwimmfest',
    ]);
  });

  it('counts the deadlines of the checklist from the date of the event', () => {
    const store = create();
    const market = event(store, 'Weihnachtsmarkt');
    expect(market.checklist).toHaveLength(21);
    expect(market.checklist[0].text).toBe('Standplatz bestätigen');
    expect(market.checklist[0].due).toBe(addDays(market.date, -60));
    expect(market.checklist.slice(0, 3).every((point) => point.done)).toBe(true);
  });

  it('ticks a point with the name of who did it, and takes the tick back', () => {
    const store = create();
    const market = event(store, 'Weihnachtsmarkt');
    const open = market.checklist.find((point) => !point.done);
    if (!open) throw new Error('no open point');
    store.toggle(market.id, open.id, 'Jonas');
    const ticked = event(store, 'Weihnachtsmarkt').checklist.find((point) => point.id === open.id);
    expect(ticked).toMatchObject({ done: true, doneBy: 'Jonas' });
    store.toggle(market.id, open.id, 'Jonas');
    const again = event(store, 'Weihnachtsmarkt').checklist.find((point) => point.id === open.id);
    expect(again).toMatchObject({ done: false, doneBy: '' });
  });

  it('adds the points of a template to an event that exists', () => {
    const store = create();
    const meeting = event(store, 'Jahreshauptversammlung');
    store.applyTemplate(meeting.id, template(store, 'Vereinsfeier').id);
    expect(event(store, 'Jahreshauptversammlung').checklist).toHaveLength(10 + 6);
  });

  it('creates a new event with the points of the chosen template', () => {
    const store = create();
    store.save(
      { ...emptyEvent('2027-06-01'), title: 'Sommerfest' },
      template(store, 'Vereinsfeier').id,
    );
    const added = event(store, 'Sommerfest');
    expect(added.id).toMatch(/^e-/);
    expect(added.checklist).toHaveLength(6);
    expect(added.checklist[0].due).toBe(addDays('2027-06-01', -60));
  });

  it('changes, adds and removes single points', () => {
    const store = create();
    const meeting = event(store, 'Jahreshauptversammlung');
    const first = meeting.checklist[0];
    store.savePoint(meeting.id, { ...first, text: 'Termin festlegen' });
    store.savePoint(meeting.id, { ...first, id: '', text: 'Neuer Punkt', who: ['Anna'] });
    const after = event(store, 'Jahreshauptversammlung').checklist;
    expect(after[0].text).toBe('Termin festlegen');
    expect(after.at(-1)).toMatchObject({ text: 'Neuer Punkt', who: ['Anna'] });
    expect(after.at(-1)?.id).toMatch(/^c-/);
    store.removePoint(meeting.id, first.id);
    expect(event(store, 'Jahreshauptversammlung').checklist).toHaveLength(10);
  });

  it('signs helpers up only when they are in the member list', () => {
    const store = create();
    const market = event(store, 'Weihnachtsmarkt');
    expect(store.addHelper(market.id, 'Niemand Unbekanntes', 'Kuchen')).toBe(false);
    expect(store.addHelper(market.id, 'anna brandt', 'Kuchen')).toBe(true);
    expect(store.addHelper(market.id, 'Maria', '', 'Maria')).toBe(true);
    const helpers = event(store, 'Weihnachtsmarkt').helpers;
    expect(helpers.map((helper) => helper.name)).toEqual([
      'Anna Brandt',
      'Mats Hartmann',
      'Anna Brandt',
      'Maria',
    ]);
    store.removeHelper(market.id, helpers[3].id);
    expect(event(store, 'Weihnachtsmarkt').helpers).toHaveLength(3);
  });

  it('removes an event', () => {
    const store = create();
    store.remove(event(store, 'Vereinsschwimmfest').id);
    expect(store.events()).toHaveLength(2);
  });

  it('keeps the standard templates and can create missing ones again', () => {
    const store = create();
    expect(store.missingStandards()).toHaveLength(0);
    store.removeTemplate(template(store, 'Weihnachtsmarkt').id);
    expect(store.missingStandards().map((entry) => entry.title)).toEqual(['Weihnachtsmarkt']);
    store.addStandardTemplates();
    expect(store.templates()).toHaveLength(5);
    expect(store.missingStandards()).toHaveLength(0);
  });

  it('saves a new template and changes an existing one', () => {
    const store = create();
    store.saveTemplate({
      id: '',
      title: 'Elternabend',
      points: [{ text: 'Einladen', category: 'Vorher', offset: -14 }],
    });
    const added = template(store, 'Elternabend');
    expect(added.id).toMatch(/^v-/);
    store.saveTemplate({ ...added, title: 'Elternabend 2' });
    expect(template(store, 'Elternabend 2').points).toHaveLength(1);
  });
});
