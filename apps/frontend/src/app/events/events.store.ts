import { Injectable, computed, inject, signal } from '@angular/core';
import { PeopleStore } from '../people/people.store';
import { addDays } from '../training/training-dates';
import { TrainingStore } from '../training/training.store';
import {
  ChecklistPoint,
  EventPlan,
  EventTemplate,
  Helper,
  PHASES,
  STANDARD_TEMPLATES,
  TemplatePoint,
  dueFor,
} from './events.models';

function compare(a: EventPlan, b: EventPlan): number {
  const finished = Number(a.state === 'Abgeschlossen') - Number(b.state === 'Abgeschlossen');
  if (finished) return finished;
  const byDate = (a.date || '9999').localeCompare(b.date || '9999');
  return a.state === 'Abgeschlossen' ? -byDate : byDate;
}

/** In-memory stand-in for the future events API. All data is invented. */
@Injectable({ providedIn: 'root' })
export class EventsStore {
  private readonly training = inject(TrainingStore);
  private readonly people = inject(PeopleStore);
  private counter = 100;
  readonly today = this.training.today;

  /** The board plans events and templates; everybody who manages the club ticks and helps. */
  readonly canEdit = this.training.isAdmin;
  readonly canTick = this.training.canManage;
  readonly memberNames = this.people.memberNames;

  readonly templates = signal<EventTemplate[]>(this.sampleTemplates());
  readonly events = signal<EventPlan[]>(this.sample());

  readonly sorted = computed(() => [...this.events()].sort(compare));
  readonly sortedTemplates = computed(() =>
    [...this.templates()].sort((a, b) => a.title.localeCompare(b.title, 'de')),
  );
  /** The standard templates that are not there (any more). */
  readonly missingStandards = computed(() =>
    STANDARD_TEMPLATES.filter(
      (standard) => !this.templates().some((template) => template.title === standard.title),
    ),
  );

  /** The name as written in the member list for a typed name or number; null if nobody matches. */
  resolveName(typed: string, keep = ''): string | null {
    return this.people.resolveName(typed, keep);
  }

  /** The points of a template, with the deadlines counted from the date of the event. */
  pointsFrom(template: EventTemplate, date: string): ChecklistPoint[] {
    return template.points.map((point) => ({
      id: this.newId('c'),
      text: point.text,
      category: point.category,
      done: false,
      doneBy: '',
      due: dueFor(date, point.offset),
      who: [],
    }));
  }

  save(plan: EventPlan, templateId = ''): void {
    const template = this.templates().find((entry) => entry.id === templateId);
    const checklist = template
      ? [...plan.checklist, ...this.pointsFrom(template, plan.date)]
      : plan.checklist;
    if (!plan.id) {
      this.events.update((list) => [...list, { ...plan, checklist, id: this.newId('e') }]);
      return;
    }
    this.events.update((list) =>
      list.map((item) => (item.id === plan.id ? { ...plan, checklist } : item)),
    );
  }

  remove(id: string): void {
    this.events.update((list) => list.filter((item) => item.id !== id));
  }

  toggle(eventId: string, pointId: string, by: string): void {
    this.patchPoints(eventId, (points) =>
      points.map((point) =>
        point.id === pointId
          ? { ...point, done: !point.done, doneBy: point.done ? '' : by }
          : point,
      ),
    );
  }

  /** Adds a point, or replaces the one with the same id. */
  savePoint(eventId: string, point: ChecklistPoint): void {
    this.patchPoints(eventId, (points) =>
      point.id
        ? points.map((entry) => (entry.id === point.id ? point : entry))
        : [...points, { ...point, id: this.newId('c') }],
    );
  }

  removePoint(eventId: string, pointId: string): void {
    this.patchPoints(eventId, (points) => points.filter((point) => point.id !== pointId));
  }

  applyTemplate(eventId: string, templateId: string): void {
    const template = this.templates().find((entry) => entry.id === templateId);
    const plan = this.events().find((entry) => entry.id === eventId);
    if (!template || !plan) return;
    const added = this.pointsFrom(template, plan.date);
    this.patchPoints(eventId, (points) => [...points, ...added]);
  }

  /** Signs a helper up; returns false when the name is not in the member list. */
  addHelper(eventId: string, typed: string, task: string, keep = ''): boolean {
    const name = this.people.resolveName(typed, keep);
    if (name === null) return false;
    const helper: Helper = { id: this.newId('h'), name, task };
    this.events.update((list) =>
      list.map((item) =>
        item.id === eventId ? { ...item, helpers: [...item.helpers, helper] } : item,
      ),
    );
    return true;
  }

  removeHelper(eventId: string, helperId: string): void {
    this.events.update((list) =>
      list.map((item) =>
        item.id === eventId
          ? { ...item, helpers: item.helpers.filter((helper) => helper.id !== helperId) }
          : item,
      ),
    );
  }

  saveTemplate(template: EventTemplate): void {
    if (!template.id) {
      this.templates.update((list) => [...list, { ...template, id: this.newId('v') }]);
      return;
    }
    this.templates.update((list) =>
      list.map((item) => (item.id === template.id ? template : item)),
    );
  }

  removeTemplate(id: string): void {
    this.templates.update((list) => list.filter((item) => item.id !== id));
  }

  addStandardTemplates(): void {
    const added = this.missingStandards().map((standard) => this.fromStandard(standard));
    this.templates.update((list) => [...list, ...added]);
  }

  private patchPoints(
    eventId: string,
    change: (points: ChecklistPoint[]) => ChecklistPoint[],
  ): void {
    this.events.update((list) =>
      list.map((item) =>
        item.id === eventId ? { ...item, checklist: change(item.checklist) } : item,
      ),
    );
  }

  private newId(prefix: string): string {
    return `${prefix}-${++this.counter}`;
  }

  private fromStandard(standard: (typeof STANDARD_TEMPLATES)[number]): EventTemplate {
    const points: TemplatePoint[] = standard.points.map(([text, phase, offset]) => ({
      text,
      category: PHASES[phase],
      offset,
    }));
    return { id: this.newId('v'), title: standard.title, points };
  }

  private sampleTemplates(): EventTemplate[] {
    return STANDARD_TEMPLATES.map((standard) => this.fromStandard(standard));
  }

  private sample(): EventPlan[] {
    const template = (title: string) => {
      const found = this.templates().find((entry) => entry.title.startsWith(title));
      if (!found) throw new Error(`no template ${title}`);
      return found;
    };
    const plan = (
      id: string,
      title: string,
      offset: number,
      extra: Partial<EventPlan>,
      templateTitle: string,
    ): EventPlan => {
      const date = addDays(this.today, offset);
      return {
        id,
        title,
        date,
        time: '',
        place: '',
        state: 'Geplant',
        material: '',
        description: '',
        checklist: this.pointsFrom(template(templateTitle), date),
        helpers: [],
        ...extra,
      };
    };
    const market = plan(
      'e-1',
      'Weihnachtsmarkt',
      30,
      {
        time: '15:00',
        place: 'Marktplatz',
        material: 'Waffeleisen, Verlängerungskabel, Kassenbox',
        description: 'Stand des Vereins mit Waffeln und Punsch.',
        helpers: [
          { id: 'h-1', name: 'Anna Brandt', task: 'Aufbau' },
          { id: 'h-2', name: 'Mats Hartmann', task: 'Verkauf' },
        ],
      },
      'Weihnachtsmarkt',
    );
    market.checklist = market.checklist.map((point, index) =>
      index < 3 ? { ...point, done: true, doneBy: 'Maria' } : point,
    );
    const meeting = plan(
      'e-2',
      'Jahreshauptversammlung',
      52,
      { time: '19:00', place: 'Vereinsheim', description: 'Einladung mit der Tagesordnung.' },
      'Jahreshauptversammlung',
    );
    const meet = plan(
      'e-3',
      'Vereinsschwimmfest',
      -40,
      { state: 'Abgeschlossen', time: '09:00', place: 'Hallenbad' },
      'Schwimmfest',
    );
    meet.checklist = meet.checklist.map((point) => ({ ...point, done: true, doneBy: 'Maria' }));
    return [market, meeting, meet];
  }
}
