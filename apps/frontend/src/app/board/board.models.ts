import { DemoRole, GroupId } from '../training/training.models';

/** A message on the notice board ("Schwarzes Brett"). */
export interface BoardPost {
  id: string;
  title: string;
  /** Formatted message text (cleaned HTML) */
  html: string;
  important: boolean;
  /** ISO date the message was written */
  date: string;
  /** Free text, e.g. "Jan, i. A. Frieda" */
  author: string;
  /** ISO date until which the message is shown; empty = until it is removed */
  until: string;
  /** Only these groups see the message; empty (together with roles) = everybody */
  groups: GroupId[];
  /** Only these roles see the message */
  roles: DemoRole[];
  /** Hex background of the whole entry; empty = none */
  bg: string;
  /** Manual position among messages of the same importance */
  order: number | null;
}

export function emptyPost(id: string, author: string, today: string): BoardPost {
  return {
    id,
    title: '',
    html: '',
    important: false,
    date: today,
    author,
    until: '',
    groups: [],
    roles: [],
    bg: '',
    order: null,
  };
}
