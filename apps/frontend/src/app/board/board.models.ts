import { GroupId } from '../training/training.models';

/** A message on the notice board ("Schwarzes Brett"). */
export interface BoardPost {
  id: string;
  title: string;
  text: string;
  important: boolean;
  /** ISO date the message was written */
  date: string;
  author: string;
  /** ISO date until which the message is shown; empty = until it is removed */
  until: string;
  /** Only these groups see the message; empty = everybody */
  groups: GroupId[];
  /** Manual position among messages of the same importance */
  order: number | null;
}

export function emptyPost(id: string, author: string, today: string): BoardPost {
  return {
    id,
    title: '',
    text: '',
    important: false,
    date: today,
    author,
    until: '',
    groups: [],
    order: null,
  };
}
