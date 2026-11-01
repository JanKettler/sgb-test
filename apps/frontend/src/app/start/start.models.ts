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
}

export interface ClubEvent {
  id: string;
  title: string;
  date: string;
  info: string;
  icon: 'tree' | 'calendar';
  /** Portal page of the event. */
  route: string;
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
