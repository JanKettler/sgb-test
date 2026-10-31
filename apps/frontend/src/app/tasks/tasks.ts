import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DateField } from '../ui/date-field';
import { Icon } from '../ui/icon';
import { LinkPicker } from '../ui/link-picker';
import { LinkTargets } from '../ui/link-targets';
import { ModalDialog } from '../ui/modal-dialog';
import { Toasts } from '../ui/toast';
import { addDays, fullDate, weekdayIndex } from '../training/training-dates';
import { downloadText } from '../training/training-download';
import { DONE_VISIBLE_DAYS, TasksStore } from './tasks.store';
import {
  REPEAT_LABEL,
  STATUS_LABEL,
  Task,
  TaskRepeat,
  TaskStatus,
  emptyTask,
} from './tasks.models';

type Filter = 'over' | 'today' | 'week' | 'mine' | 'open' | 'done';
type Layout = 'list' | 'columns';

interface Section {
  key: string;
  label: string;
  tone: string;
  tasks: Task[];
}

const REPEATS = Object.entries(REPEAT_LABEL) as [TaskRepeat, string][];
const STATUSES = Object.entries(STATUS_LABEL) as [TaskStatus, string][];

/** Task list of the club, built after the task page of the old Intranet. */
@Component({
  selector: 'app-tasks',
  imports: [NgTemplateOutlet, RouterLink, Icon, ModalDialog, DateField, LinkPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tasks.html',
  styleUrl: './tasks.scss',
})
export class Tasks {
  protected readonly store = inject(TasksStore);
  private readonly toasts = inject(Toasts);
  private readonly targets = inject(LinkTargets);
  private readonly route = inject(ActivatedRoute);
  private readonly today = this.store.todayIso;

  protected readonly repeats = REPEATS;
  protected readonly statuses = STATUSES;
  protected readonly repeatLabel = REPEAT_LABEL;

  protected readonly layout = signal<Layout>('list');
  protected readonly query = signal('');
  protected readonly opened = signal<string | null>(
    this.route.snapshot.queryParamMap.get('aufgabe'),
  );
  protected readonly filter = signal<Filter>(
    this.route.snapshot.queryParamMap.get('aufgabe') ? 'open' : 'mine',
  );
  protected readonly editing = signal<Task | null>(null);
  protected readonly subText = signal('');
  protected readonly whoText = signal('');
  protected readonly toDelete = signal<Task | null>(null);
  protected readonly commenting = signal<Task | null>(null);
  protected readonly commentText = signal('');
  protected readonly invalid = signal(false);

  private readonly weekEnd = computed(() => {
    const t = this.today;
    return addDays(t, (7 - weekdayIndex(t)) % 7);
  });

  private readonly searched = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.store
      .tasks()
      .filter(
        (task) =>
          !q || `${task.title} ${task.text} ${task.who.join(' ')}`.toLowerCase().includes(q),
      )
      .sort(this.byDue);
  });

  protected readonly counts = computed(() => {
    const open = this.store.open();
    return {
      over: open.filter((task) => task.due && task.due < this.today).length,
      today: open.filter((task) => task.due === this.today).length,
      week: open.filter((task) => task.due && task.due >= this.today && task.due <= this.weekEnd())
        .length,
      mine: this.store.mine().length,
      open: open.length,
      done: this.store.done().length,
    };
  });

  protected readonly chips = computed(() => {
    const c = this.counts();
    const all: { key: Filter; label: string; count: number; bad: boolean }[] = [
      { key: 'over', label: 'Überfällig', count: c.over, bad: true },
      { key: 'today', label: 'Heute', count: c.today, bad: false },
      { key: 'week', label: 'Diese Woche', count: c.week, bad: false },
      { key: 'mine', label: 'Meine', count: c.mine, bad: false },
      { key: 'open', label: 'Alle offenen', count: c.open, bad: false },
      { key: 'done', label: 'Erledigt', count: c.done, bad: false },
    ];
    const current = this.filter();
    return all.filter(
      (chip) =>
        chip.count > 0 || chip.key === current || ['mine', 'open', 'done'].includes(chip.key),
    );
  });

  protected readonly visible = computed(() => {
    const t = this.today;
    const week = this.weekEnd();
    const open = (task: Task) => task.status !== 'done';
    switch (this.filter()) {
      case 'over':
        return this.searched().filter((task) => open(task) && task.due && task.due < t);
      case 'today':
        return this.searched().filter((task) => open(task) && task.due === t);
      case 'week':
        return this.searched().filter(
          (task) => open(task) && task.due >= t && task.due <= week && task.due,
        );
      case 'mine':
        return this.searched().filter((task) => open(task) && this.store.isMine(task));
      case 'open':
        return this.searched().filter(open);
      case 'done':
        return this.searched()
          .filter((task) => !open(task))
          .sort((a, b) => b.doneOn.localeCompare(a.doneOn));
    }
  });

  protected readonly sections = computed<Section[]>(() => {
    const t = this.today;
    const week = this.weekEnd();
    const groups: Section[] = [
      { key: 'over', label: 'Überfällig', tone: 'is-bad', tasks: [] },
      { key: 'today', label: 'Heute', tone: '', tasks: [] },
      { key: 'week', label: 'Diese Woche', tone: '', tasks: [] },
      { key: 'later', label: 'Später', tone: '', tasks: [] },
      { key: 'none', label: 'Ohne Datum', tone: '', tasks: [] },
    ];
    for (const task of this.visible()) {
      const index = !task.due
        ? 4
        : task.due < t
          ? 0
          : task.due === t
            ? 1
            : task.due <= week
              ? 2
              : 3;
      groups[index].tasks.push(task);
    }
    return groups.filter((group) => group.tasks.length > 0);
  });

  protected readonly columns = computed(() => {
    const list = this.visible();
    const recent = addDays(this.today, -DONE_VISIBLE_DAYS);
    return STATUSES.map(([status, label]) => ({
      status,
      label,
      tasks: list.filter(
        (task) => task.status === status && (status !== 'done' || task.doneOn >= recent),
      ),
    }));
  });

  private byDue = (a: Task, b: Task): number => {
    const left = a.due || '9999';
    const right = b.due || '9999';
    return left.localeCompare(right) || Number(b.high) - Number(a.high);
  };

  protected dueText(task: Task): string {
    if (!task.due) return '';
    const days = this.store.daysTo(task.due);
    const date = fullDate(task.due).slice(0, 6);
    if (task.status === 'done') return `bis ${date}`;
    if (days < 0) return `bis ${date} · ${-days} Tg. überfällig`;
    if (days === 0) return `bis ${date} · heute`;
    return days === 1 ? `bis ${date} · morgen` : `bis ${date}`;
  }

  protected isOver(task: Task): boolean {
    return task.status !== 'done' && !!task.due && this.store.daysTo(task.due) <= 0;
  }

  protected subsDone(task: Task): number {
    return task.subs.filter((sub) => sub.done).length;
  }

  protected linkLabel(task: Task): string {
    return this.targets.labelOf(task.link);
  }

  protected linkRoute(path: string): { path: string; query: Record<string, string> } {
    const [target, query = ''] = path.split('?');
    return { path: target, query: Object.fromEntries(new URLSearchParams(query)) };
  }

  protected fullDate = fullDate;

  protected toggleOpen(task: Task): void {
    this.opened.update((id) => (id === task.id ? null : task.id));
  }

  protected add(): void {
    this.invalid.set(false);
    this.subText.set('');
    this.whoText.set(this.store.me());
    this.editing.set(emptyTask(this.store.me()));
  }

  protected edit(task: Task): void {
    this.invalid.set(false);
    this.subText.set(task.subs.map((sub) => sub.text).join('\n'));
    this.whoText.set(task.who.join(', '));
    this.editing.set({ ...task });
  }

  protected change(fields: Partial<Task>): void {
    this.editing.update((task) => (task ? { ...task, ...fields } : task));
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  protected save(): void {
    const task = this.editing();
    if (!task) return;
    if (!task.title.trim()) {
      this.invalid.set(true);
      this.toasts.failed('Bitte einen Titel eingeben');
      return;
    }
    const known = new Map(task.subs.map((sub) => [sub.text, sub.done]));
    const subs = this.subText()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ text, done: known.get(text) ?? false }));
    const who = this.whoText()
      .split(/[,;]/)
      .map((name) => name.trim())
      .filter(Boolean);
    this.store.save({ ...task, title: task.title.trim(), subs, who });
    this.editing.set(null);
    this.toasts.saved(task.id ? 'Aufgabe gespeichert' : 'Aufgabe angelegt');
  }

  protected cancel(): void {
    this.editing.set(null);
    this.toasts.cancelled();
  }

  protected tick(task: Task, event: Event): void {
    event.stopPropagation();
    if (!this.store.canTick(task)) return;
    const was = task.status === 'done';
    this.store.toggleDone(task.id);
    this.toasts.show(was ? 'Aufgabe wieder offen' : 'Aufgabe erledigt');
  }

  protected tickSub(task: Task, index: number): void {
    if (this.store.canTick(task)) this.store.toggleSub(task.id, index);
  }

  protected confirmDelete(): void {
    const task = this.toDelete();
    if (!task) return;
    this.store.remove(task.id);
    this.toDelete.set(null);
    this.toasts.saved('Aufgabe gelöscht');
  }

  protected sendComment(): void {
    const task = this.commenting();
    if (!task) return;
    if (!this.commentText().trim()) {
      this.toasts.failed('Bitte einen Kommentar eingeben');
      return;
    }
    this.store.comment(task.id, this.commentText());
    this.commenting.set(null);
    this.commentText.set('');
    this.toasts.saved('Kommentar gespeichert');
  }

  protected exportList(): void {
    const rows = this.store.open();
    if (rows.length === 0) {
      this.toasts.failed('Keine offenen Aufgaben');
      return;
    }
    const head = [
      'Aufgabe',
      'Beschreibung',
      'Zuständig',
      'Bis',
      'Status',
      'Wichtig',
      'Teilschritte',
    ];
    const lines = rows
      .sort(this.byDue)
      .map((task) =>
        [
          task.title,
          task.text,
          task.who.join(', '),
          task.due ? fullDate(task.due) : '',
          STATUS_LABEL[task.status],
          task.high ? 'ja' : '',
          task.subs.map((sub) => `${sub.done ? '✓' : '○'} ${sub.text}`).join(' | '),
        ]
          .map((cell) => `"${cell.replace(/"/g, '""')}"`)
          .join(';'),
      );
    downloadText('Offene_Aufgaben.csv', `﻿${[head.join(';'), ...lines].join('\n')}`);
    this.toasts.saved('Liste heruntergeladen');
  }
}
