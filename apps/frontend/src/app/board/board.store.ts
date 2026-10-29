import { Injectable, computed, inject, signal } from '@angular/core';
import { addDays } from '../training/training-dates';
import { GroupId } from '../training/training.models';
import { TrainingStore } from '../training/training.store';
import { BoardPost, emptyPost } from './board.models';

/** In-memory stand-in for the future notice board API. All texts are invented. */
@Injectable({ providedIn: 'root' })
export class BoardStore {
  private readonly training = inject(TrainingStore);
  private readonly today = this.training.today;
  private nextId = 1;

  readonly posts = signal<BoardPost[]>(this.sample());
  /** The author of new messages; the demo has no real login. */
  readonly author = 'Orga-Team';
  readonly canWrite = this.training.canManage;
  /** Messages written after this day count as new. Kept per person in the real system. */
  readonly seenOn = signal(addDays(this.today, -4));

  /** The groups of the people the current user acts for. */
  private readonly viewerGroups = computed(
    () =>
      new Set<GroupId>(
        this.training
          .actors()
          .flatMap((person) => [person.groupId, ...person.trainerGroupIds])
          .filter((id): id is GroupId => id !== null),
      ),
  );

  readonly live = computed(() =>
    this.sorted(this.posts().filter((post) => !this.expired(post) && this.visible(post))),
  );
  readonly archive = computed(() => this.sorted(this.posts().filter((post) => this.expired(post))));

  expired(post: BoardPost): boolean {
    return post.until !== '' && post.until < this.today;
  }

  /** Authors see everything; others only messages for everybody or for their role or groups. */
  visible(post: BoardPost): boolean {
    if (this.canWrite()) return true;
    if (post.groups.length === 0 && post.roles.length === 0) return true;
    if (post.roles.includes(this.training.role())) return true;
    return post.groups.some((id) => this.viewerGroups().has(id));
  }

  isNew(post: BoardPost): boolean {
    return post.date > this.seenOn() && post.author !== this.author;
  }

  markSeen(): void {
    this.seenOn.set(this.today);
  }

  newPost(): BoardPost {
    return emptyPost(`b-new-${this.nextId++}`, this.author, this.today);
  }

  save(post: BoardPost): void {
    const exists = this.posts().some((item) => item.id === post.id);
    this.posts.update((all) =>
      exists ? all.map((item) => (item.id === post.id ? post : item)) : [post, ...all],
    );
  }

  remove(id: string): void {
    this.posts.update((all) => all.filter((post) => post.id !== id));
  }

  /** Moves a live message up or down; important and normal messages stay apart. */
  move(id: string, direction: -1 | 1): void {
    const list = this.live();
    const index = list.findIndex((post) => post.id === id);
    const other = list[index + direction];
    if (index < 0 || !other || other.important !== list[index].important) return;
    const order = new Map(list.map((post, position) => [post.id, position]));
    order.set(id, index + direction);
    order.set(other.id, index);
    this.posts.update((all) =>
      all.map((post) => (order.has(post.id) ? { ...post, order: order.get(post.id)! } : post)),
    );
  }

  private sorted(list: BoardPost[]): BoardPost[] {
    return [...list].sort(
      (a, b) =>
        Number(b.important) - Number(a.important) ||
        (a.order ?? -1) - (b.order ?? -1) ||
        b.date.localeCompare(a.date),
    );
  }

  private sample(): BoardPost[] {
    const day = (offset: number) => addDays(this.today, offset);
    const base = { author: 'Orga-Team', groups: [], roles: [], bg: '', order: null };
    return [
      {
        ...base,
        id: 'b-1',
        title: 'Hallenzeiten in den Herbstferien',
        html: 'Das Training der Gruppe 3 fällt in den Ferien aus. <b>Die WK-Gruppe trainiert wie gewohnt.</b>',
        important: true,
        date: day(-2),
        until: day(14),
      },
      {
        ...base,
        author: 'Vorstand',
        id: 'b-2',
        title: 'Weihnachtsmarkt: Helfer gesucht',
        html: 'Für den Stand brauchen wir noch Helferinnen und Helfer. Bitte bei den Trainern melden oder direkt im <a href="/training/anmeldung">Training</a> nachfragen.',
        important: false,
        date: day(-1),
        until: '',
        bg: '#fff7d6',
      },
      {
        ...base,
        id: 'b-3',
        title: 'Neue Vereinsjacken sind da',
        html: 'Die bestellten Jacken können montags nach dem Training abgeholt werden.',
        important: false,
        date: day(-9),
        until: day(30),
      },
      {
        ...base,
        author: 'Vorstand',
        id: 'b-4',
        title: 'Trainerfortbildung im Winter',
        html: 'Termin und Ort folgen. Wer teilnehmen möchte, meldet sich bis Ende des Monats.',
        important: false,
        date: day(-12),
        until: '',
        groups: ['WK', 'G3'],
        roles: ['trainer'],
      },
      {
        ...base,
        id: 'b-5',
        title: 'Sommerfest: Danke!',
        html: 'Danke an alle, die beim <span style="color:#16a34a;font-size:20px">Sommerfest</span> geholfen haben.',
        important: false,
        date: day(-60),
        until: day(-20),
      },
    ];
  }
}
