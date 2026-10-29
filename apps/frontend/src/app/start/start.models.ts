import { IconName } from '../ui/icon';

/** A swim meet. Meets have no module of their own yet, only what the start page shows. */
export interface Competition {
  id: string;
  title: string;
  date: string;
  place: string;
  /** Deadline for the club's own team, ISO date */
  internalDeadline: string;
  /** Official entry deadline, ISO date */
  deadline: string;
  entriesSent: boolean;
  starters: { name: string; starts: number }[];
}

export interface ClubEvent {
  id: string;
  title: string;
  date: string;
  info: string;
  icon: 'tree' | 'calendar';
}

export interface ClubTask {
  id: string;
  title: string;
  /** ISO date; empty = no due date */
  due: string;
  high: boolean;
  /** First names of the people the task is assigned to */
  who: string[];
}

export type Tone = 'bad' | 'warn' | 'info';

/** One line of "Fristen und Hinweise". */
export interface Notice {
  title: string;
  text: string;
  tone: Tone;
  route: string;
  /** Sort key: days until the deadline */
  days: number;
}

export type TileCategory = 'Training' | 'Verein';

export interface Tile {
  category: TileCategory;
  label: string;
  hint: string;
  route: string;
  icon: IconName;
  /** Optional status below the text, with a coloured dot */
  status?: { text: string; tone: Tone | 'ok' };
}
