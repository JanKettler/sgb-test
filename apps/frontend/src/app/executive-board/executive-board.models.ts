export const MOTION_STATES = [
  'Entwurf',
  'Eingereicht',
  'Beschlossen',
  'Abgelehnt',
  'Zurückgestellt',
] as const;
export type MotionState = (typeof MOTION_STATES)[number];

export const MEETING_STATES = ['Geplant', 'Durchgeführt'] as const;
export type MeetingState = (typeof MEETING_STATES)[number];

export type ResolutionState = 'open' | 'working' | 'done';

export const RESOLUTION_LABEL: Record<ResolutionState, string> = {
  open: 'Offen',
  working: 'In Arbeit',
  done: 'Erledigt',
};

export const RESOLUTION_STATES = Object.keys(RESOLUTION_LABEL) as ResolutionState[];

/** A motion to the board. The title, subtitle and heading are printed in the letterhead layout. */
export interface Motion {
  id: string;
  title: string;
  subtitle: string;
  heading: string;
  /** ISO date */
  date: string;
  author: string;
  state: MotionState;
  text: string;
  decision: string;
}

export interface Meeting {
  id: string;
  title: string;
  /** ISO date */
  date: string;
  /** HH:mm or empty */
  time: string;
  place: string;
  state: MeetingState;
  /** One entry per agenda item. */
  agenda: string[];
  attendees: string;
  secretary: string;
  /** The minutes as an outline, see `parseOutline`. */
  minutes: string;
}

/** A decision of the board with someone responsible and a deadline. */
export interface Resolution {
  id: string;
  /** e.g. "2026/12" */
  number: string;
  title: string;
  /** ISO date */
  date: string;
  who: string[];
  /** ISO date; empty when there is no deadline. */
  due: string;
  state: ResolutionState;
  text: string;
  /** A task was created for this decision. */
  taskCreated: boolean;
  /** The motion this decision comes from, if any. */
  motionId: string;
}

export function motionStateOf(value: string): MotionState {
  return MOTION_STATES.find((state) => state === value) ?? 'Entwurf';
}

export function meetingStateOf(value: string): MeetingState {
  return MEETING_STATES.find((state) => state === value) ?? 'Geplant';
}

export function resolutionStateOf(value: string): ResolutionState {
  return RESOLUTION_STATES.find((state) => state === value) ?? 'open';
}

export function emptyMotion(date: string, author: string): Motion {
  return {
    id: '',
    title: '',
    subtitle: '',
    heading: '',
    date,
    author,
    state: 'Entwurf',
    text: '',
    decision: '',
  };
}

export function emptyMeeting(date: string): Meeting {
  return {
    id: '',
    title: '',
    date,
    time: '',
    place: '',
    state: 'Geplant',
    agenda: [],
    attendees: '',
    secretary: '',
    minutes: '',
  };
}

export function emptyResolution(date: string): Resolution {
  return {
    id: '',
    number: '',
    title: '',
    date,
    who: [],
    due: '',
    state: 'open',
    text: '',
    taskCreated: false,
    motionId: '',
  };
}

export function isOpen(resolution: Resolution): boolean {
  return resolution.state !== 'done';
}

export function isOverdue(resolution: Resolution, today: string): boolean {
  return isOpen(resolution) && resolution.due !== '' && resolution.due < today;
}
