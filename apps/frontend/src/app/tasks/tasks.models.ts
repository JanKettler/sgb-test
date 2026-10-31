export type TaskStatus = 'open' | 'working' | 'done';
export type TaskRepeat = '' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface SubTask {
  text: string;
  done: boolean;
}

export interface TaskComment {
  author: string;
  text: string;
  /** ISO date */
  on: string;
}

/** One to-do of the club. */
export interface Task {
  id: string;
  title: string;
  text: string;
  /** First names of the people responsible */
  who: string[];
  /** ISO date; empty = no due date */
  due: string;
  status: TaskStatus;
  high: boolean;
  repeat: TaskRepeat;
  subs: SubTask[];
  comments: TaskComment[];
  /** Portal page this task refers to, e.g. "/wettkaempfe/c-1"; empty = none */
  link: string;
  by: string;
  /** ISO date and name, set when the task is ticked off */
  doneOn: string;
  doneBy: string;
}

export const REPEAT_LABEL: Record<TaskRepeat, string> = {
  '': 'Nie',
  weekly: 'Jede Woche',
  biweekly: 'Alle 2 Wochen',
  monthly: 'Jeden Monat',
  yearly: 'Jedes Jahr',
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Offen',
  working: 'In Arbeit',
  done: 'Erledigt',
};

export function emptyTask(by: string): Task {
  return {
    id: '',
    title: '',
    text: '',
    who: [],
    due: '',
    status: 'open',
    high: false,
    repeat: '',
    subs: [],
    comments: [],
    link: '',
    by,
    doneOn: '',
    doneBy: '',
  };
}
