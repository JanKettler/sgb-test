import { Injectable, computed, inject, signal } from '@angular/core';
import { StartStore } from '../start/start.store';
import { addDays, addMonths } from '../training/training-dates';
import { Task, TaskRepeat } from './tasks.models';

/** Days after which a finished task disappears from the board columns. */
export const DONE_VISIBLE_DAYS = 14;

/** In-memory stand-in for the future task API. All data is invented. */
@Injectable({ providedIn: 'root' })
export class TasksStore {
  private readonly start = inject(StartStore);
  private readonly today = this.start.today;
  readonly todayIso = this.today;
  private counter = 100;

  readonly tasks = signal<Task[]>(this.sample());

  readonly me = this.start.userName;
  /** Only the board can create, edit and delete; everybody else may tick their own tasks. */
  readonly canEdit = this.start.canSeeAllTasks;

  readonly open = computed(() => this.tasks().filter((task) => task.status !== 'done'));
  readonly mine = computed(() => this.open().filter((task) => this.isMine(task)));
  readonly done = computed(() => this.tasks().filter((task) => task.status === 'done'));

  isMine(task: Task): boolean {
    return task.who.includes(this.me()) || (task.who.length === 0 && task.by === this.me());
  }

  canTick(task: Task): boolean {
    return this.canEdit() || this.isMine(task);
  }

  find(id: string): Task | undefined {
    return this.tasks().find((task) => task.id === id);
  }

  save(task: Task): void {
    if (!task.id) {
      this.tasks.update((list) => [...list, { ...task, id: `t-${++this.counter}` }]);
      return;
    }
    this.tasks.update((list) =>
      list.map((item) => (item.id === task.id ? this.withDoneInfo(item, task) : item)),
    );
  }

  remove(id: string): void {
    this.tasks.update((list) => list.filter((task) => task.id !== id));
  }

  /** Ticks a task off or reopens it. A repeating task creates its successor. */
  toggleDone(id: string): void {
    const task = this.find(id);
    if (!task) return;
    if (task.status === 'done') {
      this.patch(id, { status: 'open', doneOn: '', doneBy: '' });
      return;
    }
    this.patch(id, { status: 'done', doneOn: this.today, doneBy: this.me() });
    const next = this.nextDue(task);
    if (task.repeat && next) {
      this.tasks.update((list) => [
        ...list,
        {
          ...task,
          id: `t-${++this.counter}`,
          due: next,
          status: 'open',
          subs: task.subs.map((sub) => ({ ...sub, done: false })),
          comments: [],
          doneOn: '',
          doneBy: '',
        },
      ]);
    }
  }

  toggleWorking(id: string): void {
    const task = this.find(id);
    if (task) this.patch(id, { status: task.status === 'working' ? 'open' : 'working' });
  }

  toggleSub(id: string, index: number): void {
    const task = this.find(id);
    if (!task) return;
    this.patch(id, {
      subs: task.subs.map((sub, i) => (i === index ? { ...sub, done: !sub.done } : sub)),
    });
  }

  comment(id: string, text: string): void {
    const task = this.find(id);
    const clean = text.trim();
    if (!task || !clean) return;
    this.patch(id, {
      comments: [...task.comments, { author: this.me(), text: clean, on: this.today }],
    });
  }

  nextDue(task: Task): string {
    const from = task.due || this.today;
    const step: Record<TaskRepeat, () => string> = {
      '': () => '',
      weekly: () => addDays(from, 7),
      biweekly: () => addDays(from, 14),
      monthly: () => addMonths(from, 1),
      yearly: () => addMonths(from, 12),
    };
    return step[task.repeat]();
  }

  daysTo(iso: string): number {
    return this.start.daysTo(iso);
  }

  private patch(id: string, fields: Partial<Task>): void {
    this.tasks.update((list) =>
      list.map((task) => (task.id === id ? { ...task, ...fields } : task)),
    );
  }

  private withDoneInfo(before: Task, after: Task): Task {
    if (after.status === 'done' && before.status !== 'done') {
      return { ...after, doneOn: this.today, doneBy: this.me() };
    }
    return after.status === 'done' ? after : { ...after, doneOn: '', doneBy: '' };
  }

  private sample(): Task[] {
    const day = (offset: number) => addDays(this.today, offset);
    const base = (fields: Partial<Task> & Pick<Task, 'id' | 'title'>): Task => ({
      text: '',
      who: [],
      due: '',
      status: 'open',
      high: false,
      repeat: '',
      subs: [],
      comments: [],
      link: '',
      by: 'Maria',
      doneOn: '',
      doneBy: '',
      ...fields,
    });
    return [
      base({
        id: 't-1',
        title: 'Meldung Hunte-Pokal prüfen',
        text: 'Meldeliste mit den Trainern abgleichen und an die Wettkampfleitung schicken.',
        due: day(2),
        high: true,
        who: ['Maria', 'Jonas'],
        link: '/wettkampf/wettkaempfe/c-1',
        subs: [
          { text: 'Starter abfragen', done: true },
          { text: 'Meldezeiten prüfen', done: false },
          { text: 'Datei hochladen', done: false },
        ],
      }),
      base({
        id: 't-2',
        title: 'Hallenzeiten für das neue Jahr anfragen',
        due: day(9),
        who: ['Maria'],
        status: 'working',
        comments: [{ author: 'Maria', text: 'Mail an die Stadt ist raus', on: day(-1) }],
      }),
      base({
        id: 't-3',
        title: 'Trainingsmaterial zählen',
        due: day(-3),
        who: ['Jonas'],
        repeat: 'monthly',
      }),
      base({
        id: 't-4',
        title: 'Helferplan Weihnachtsmarkt schreiben',
        due: day(14),
        high: true,
        who: ['Jonas'],
        subs: [
          { text: 'Schichten festlegen', done: false },
          { text: 'Helfer anschreiben', done: false },
        ],
      }),
      base({ id: 't-5', title: 'Urkunden bestellen', who: ['Maria'] }),
      base({ id: 't-6', title: 'Vereinsjacken Restbestand melden', due: day(21), who: ['Sabine'] }),
      base({
        id: 't-7',
        title: 'Gruppe-1-Anwesenheit nachtragen',
        due: day(0),
        who: ['Jonas'],
        link: '/training/anwesenheit',
      }),
      base({
        id: 't-8',
        title: 'Beitragsmahnungen versenden',
        status: 'done',
        who: ['Maria'],
        doneOn: day(-2),
        doneBy: 'Maria',
      }),
    ];
  }
}
