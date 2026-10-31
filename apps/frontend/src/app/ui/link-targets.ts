import { Injectable, computed, inject } from '@angular/core';
import { PeopleStore } from '../people/people.store';
import { StartStore } from '../start/start.store';
import { TasksStore } from '../tasks/tasks.store';
import { endTime, shortDay } from '../training/training-dates';
import { TrainingStore } from '../training/training.store';
import { INTERNAL_PAGES } from './internal-pages';

export interface LinkTarget {
  label: string;
  path: string;
}

export interface LinkGroup {
  label: string;
  targets: LinkTarget[];
}

const SESSION_LIMIT = 30;

/** Everything in the portal that a message, a task or a note can link to. */
@Injectable({ providedIn: 'root' })
export class LinkTargets {
  private readonly training = inject(TrainingStore);
  private readonly start = inject(StartStore);
  private readonly tasks = inject(TasksStore);
  private readonly people = inject(PeopleStore);

  readonly groups = computed<LinkGroup[]>(() => {
    const today = this.training.today;
    const groups: LinkGroup[] = [{ label: 'Seiten', targets: [...INTERNAL_PAGES] }];
    const sessions = this.training
      .sessions()
      .filter((session) => session.date >= today)
      .slice(0, SESSION_LIMIT)
      .map((session) => ({
        label: `${shortDay(session.date)} ${session.time}–${endTime(session.time, session.durationMinutes)}, ${session.groupIds
          .map((id) => this.training.groupName(id))
          .join(' + ')}`,
        path: `/training/termine/${session.id}`,
      }));
    if (sessions.length > 0) groups.push({ label: 'Trainingstermine', targets: sessions });
    const meets = this.start.upcomingCompetitions().map((meet) => ({
      label: `${meet.title} (${shortDay(meet.date)})`,
      path: `/wettkaempfe/${meet.id}`,
    }));
    if (meets.length > 0) groups.push({ label: 'Wettkämpfe', targets: meets });
    const tasks = this.tasks.open().map((task) => ({
      label: task.title,
      path: `/aufgaben?aufgabe=${task.id}`,
    }));
    if (tasks.length > 0) groups.push({ label: 'Aufgaben', targets: tasks });
    if (this.training.canManage()) {
      groups.push({
        label: 'Personen',
        targets: this.people.activeMembers().map((member) => ({
          label: `${member.firstName} ${member.lastName}`,
          path: `/personen/${member.id}`,
        })),
      });
    }
    return groups;
  });

  /** A readable name for a stored path, or the path itself when it is unknown. */
  labelOf(path: string): string {
    for (const group of this.groups()) {
      const hit = group.targets.find((target) => target.path === path);
      if (hit) return hit.label;
    }
    return path;
  }
}
