import { addDays } from '../training/training-dates';

export const EVENT_STATES = ['Geplant', 'Läuft', 'Abgeschlossen'] as const;
export type EventState = (typeof EVENT_STATES)[number];

/** The three phases the standard templates use; other category names are allowed as well. */
export const PHASES = { before: 'Vorher', onTheDay: 'Am Tag', after: 'Danach' } as const;

export interface ChecklistPoint {
  id: string;
  text: string;
  /** A phase or an area, e.g. "Vorher" or "Verkauf". */
  category: string;
  done: boolean;
  /** Who ticked the point off. */
  doneBy: string;
  /** ISO date; empty when there is no deadline. */
  due: string;
  who: string[];
}

export interface Helper {
  id: string;
  name: string;
  task: string;
}

/** A club event (party, meeting, market, own swim meet) with its checklist and helpers. */
export interface EventPlan {
  id: string;
  title: string;
  /** ISO date; empty while the date is open. */
  date: string;
  /** HH:mm or empty. */
  time: string;
  place: string;
  state: EventState;
  material: string;
  description: string;
  checklist: ChecklistPoint[];
  helpers: Helper[];
}

/** A point of a template: the deadline is a number of days before (-) or after (+) the date. */
export interface TemplatePoint {
  text: string;
  category: string;
  offset: number;
}

export interface EventTemplate {
  id: string;
  title: string;
  points: TemplatePoint[];
}

type StandardPoint = readonly [text: string, phase: keyof typeof PHASES, offset: number];

/** The ready-made templates of the club; they can be created again at any time. */
export const STANDARD_TEMPLATES: readonly { title: string; points: readonly StandardPoint[] }[] = [
  {
    title: 'Schwimmfest (eigene Ausrichtung)',
    points: [
      ['Halle und Termin bestätigen', 'before', -90],
      ['Ausschreibung erstellen und versenden', 'before', -60],
      ['Meldeschluss festlegen', 'before', -60],
      ['Kampfgericht einladen', 'before', -45],
      ['Zeitnehmer und Helfer einteilen', 'before', -21],
      ['Meldeergebnis erstellen und verschicken', 'before', -7],
      ['Kuchenverkauf und Verpflegung organisieren', 'before', -7],
      ['Urkunden und Medaillen besorgen', 'before', -14],
      ['Stoppuhren, Startblöcke und Technik prüfen', 'before', -2],
      ['Aufbau', 'onTheDay', 0],
      ['Abbau und Aufräumen', 'onTheDay', 0],
      ['Ergebnisse veröffentlichen', 'after', 1],
      ['Abrechnung', 'after', 7],
    ],
  },
  {
    title: 'Weihnachtsmarkt',
    points: [
      ['Standplatz bestätigen', 'before', -60],
      ['Helfer einteilen', 'before', -21],
      ['Aushang gestalten', 'before', -30],
      ['Aushang drucken und aufhängen', 'before', -14],
      ['Produktliste und Preise festlegen', 'before', -21],
      ['Einkauf erledigen', 'before', -3],
      ['Rezepte und Mengen festlegen', 'before', -21],
      ['Zutaten je Rezept prüfen', 'before', -7],
      ['Standskizze zeichnen', 'before', -14],
      ['Strombedarf berechnen', 'before', -14],
      ['Verteiler und Kabel bereitlegen', 'before', -3],
      ['Leihgaben anfragen', 'before', -14],
      ['Boxen packen und beschriften', 'before', -2],
      ['Wechselgeld besorgen', 'before', -2],
      ['Aufbauplan und Helfer abstimmen', 'before', -7],
      ['Aufbau', 'onTheDay', 0],
      ['Stand abnehmen lassen', 'onTheDay', 0],
      ['Abbau', 'onTheDay', 0],
      ['Leihgaben zurückgeben', 'after', 2],
      ['Kasse zählen und abrechnen', 'after', 2],
      ['Bestand zählen und einlagern', 'after', 3],
    ],
  },
  {
    title: 'Jugendversammlung (JV)',
    points: [
      ['Termin bestimmen (vor der Jahreshauptversammlung)', 'before', -70],
      ['Raum reservieren', 'before', -70],
      ['Einladung', 'before', -60],
      ['Jahresauswertung', 'before', -60],
      ['Jahresauswertung drucken', 'before', -30],
      ['Medaillen bestellen', 'before', -30],
      ['Präsentation', 'before', -5],
      ['Spiele', 'before', -5],
      ['Getränke', 'before', -3],
      ['Süßes', 'before', -3],
      ['Feedback vorbereiten', 'before', -2],
    ],
  },
  {
    title: 'Jahreshauptversammlung (JHV)',
    points: [
      ['Termin bestimmen', 'before', -90],
      ['Raum reservieren', 'before', -90],
      ['Einladung', 'before', -60],
      ['Jahresauswertung', 'before', -60],
      ['Pokale gravieren', 'before', -30],
      ['Urkunden für Jubiläen (aus der Mitgliederliste)', 'before', -20],
      ['Präsentation', 'before', -5],
      ['Unterschriftenliste', 'before', -1],
      ['Übersicht Jubiläen', 'before', -1],
      ['Beamer', 'onTheDay', 0],
    ],
  },
  {
    title: 'Vereinsfeier / Ausflug',
    points: [
      ['Termin und Ort festlegen', 'before', -60],
      ['Einladung verschicken', 'before', -35],
      ['Anmeldungen sammeln', 'before', -14],
      ['Verpflegung planen', 'before', -10],
      ['Fahrdienste klären', 'before', -7],
      ['Kosten abrechnen', 'after', 7],
    ],
  },
];

export function stateOf(value: string): EventState {
  return EVENT_STATES.find((state) => state === value) ?? 'Geplant';
}

/** The categories of a checklist in the order they first appear. */
export function categoriesOf(points: readonly { category: string }[]): string[] {
  return [...new Set(points.map((point) => point.category))];
}

export function progressOf(points: readonly ChecklistPoint[]): { done: number; total: number } {
  return { done: points.filter((point) => point.done).length, total: points.length };
}

/** The deadline of a point of a template, counted from the date of the event. */
export function dueFor(date: string, offset: number): string {
  return date ? addDays(date, offset) : '';
}

/** A usual deadline for a category when none is given: before, on the day or after. */
export function defaultOffset(category: string): number {
  const name = category.trim().toLocaleLowerCase('de');
  if (name === 'am tag' || name.startsWith('t')) return 0;
  if (name === 'danach' || name.startsWith('n')) return 1;
  return -7;
}

/** One line per point: "Punkt | Kategorie | Tage zum Datum". */
export function templateText(points: readonly TemplatePoint[]): string {
  return points.map((point) => `${point.text} | ${point.category} | ${point.offset}`).join('\n');
}

export function parseTemplateText(text: string): TemplatePoint[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const [pointText, category = '', days = ''] = line.split('|').map((part) => part.trim());
      const name = category || PHASES.before;
      const offset = Number.parseInt(days, 10);
      return {
        text: pointText,
        category: name,
        offset: Number.isFinite(offset) ? offset : defaultOffset(name),
      };
    });
}

export function emptyEvent(date: string): EventPlan {
  return {
    id: '',
    title: '',
    date,
    time: '',
    place: '',
    state: 'Geplant',
    material: '',
    description: '',
    checklist: [],
    helpers: [],
  };
}
