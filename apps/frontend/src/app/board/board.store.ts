import { Injectable, computed, inject, signal } from '@angular/core';
import { addDays } from '../training/training-dates';
import { GroupId } from '../training/training.models';
import { TrainingStore } from '../training/training.store';
import { ArchiveEntry, BoardPost, emptyPost } from './board.models';

const ARCHIVE_DAYS = 30;

/** A big bold first line, which is how the heading of a message looks. */
function heading(text: string): string {
  return `<div style="font-size:20px"><b>${text}</b></div>`;
}

/** In-memory stand-in for the future notice board API. All texts are invented. */
@Injectable({ providedIn: 'root' })
export class BoardStore {
  private readonly training = inject(TrainingStore);
  private readonly today = this.training.today;
  private nextId = 1;

  readonly posts = signal<BoardPost[]>(this.sample());
  /** Deleted messages stay findable in the archive for 30 days. */
  private readonly trash = signal<{ post: BoardPost; deletedOn: string }[]>(this.sampleTrash());
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
  /** Everyone who may write also sees the archive: expired and deleted messages of the last 30 days. */
  readonly archive = computed<ArchiveEntry[]>(() => {
    const since = addDays(this.today, -ARCHIVE_DAYS);
    const entries: ArchiveEntry[] = [
      ...this.posts()
        .filter((post) => this.expired(post) && post.until >= since)
        .map((post) => ({ post, reason: 'expired' as const, on: post.until })),
      ...this.trash()
        .filter((item) => item.deletedOn >= since)
        .map((item) => ({ post: item.post, reason: 'deleted' as const, on: item.deletedOn })),
    ];
    return entries.sort((a, b) => b.on.localeCompare(a.on));
  });

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
    const post = this.posts().find((item) => item.id === id);
    if (!post) return;
    this.posts.update((all) => all.filter((item) => item.id !== id));
    this.trash.update((all) => [{ post, deletedOn: this.today }, ...all]);
  }

  /** Takes a deleted message back onto the board. */
  restore(id: string): void {
    const item = this.trash().find((entry) => entry.post.id === id);
    if (!item) return;
    this.trash.update((all) => all.filter((entry) => entry.post.id !== id));
    this.posts.update((all) => [item.post, ...all]);
  }

  private sorted(list: BoardPost[]): BoardPost[] {
    return [...list].sort(
      (a, b) => Number(b.important) - Number(a.important) || b.date.localeCompare(a.date),
    );
  }

  private sampleTrash(): { post: BoardPost; deletedOn: string }[] {
    return [
      {
        deletedOn: addDays(this.today, -6),
        post: {
          id: 'b-6',
          html:
            heading('Hallenschlüssel zurückgeben') +
            'Bitte die Schlüssel bis Freitag im Vereinsheim abgeben.',
          important: false,
          date: addDays(this.today, -15),
          author: 'Orga-Team',
          until: '',
          groups: [],
          roles: [],
          bg: '',
          order: null,
        },
      },
    ];
  }

  private sample(): BoardPost[] {
    const day = (offset: number) => addDays(this.today, offset);
    const base = { author: 'Orga-Team', groups: [], roles: [], bg: '', order: null };
    return [
      {
        ...base,
        id: 'b-1',
        html:
          heading('Hallenzeiten in den Herbstferien') +
          'Das Training der Gruppe 3 fällt in den Ferien aus. <b>Die WK-Gruppe trainiert wie gewohnt.</b>',
        important: true,
        date: day(-2),
        until: day(14),
      },
      {
        ...base,
        author: 'Vorstand',
        id: 'b-2',
        html:
          heading('Weihnachtsmarkt: Helfer gesucht') +
          'Für den Stand brauchen wir noch Helferinnen und Helfer. Bitte bei den Trainern melden oder direkt im <a href="/training/anmeldung">Training</a> nachfragen.',
        important: false,
        date: day(-1),
        until: '',
        bg: '#fff7d6',
      },
      {
        ...base,
        id: 'b-3',
        html:
          heading('Neue Vereinsjacken sind da') +
          'Die bestellten Jacken können montags nach dem Training abgeholt werden.',
        important: false,
        date: day(-9),
        until: day(30),
      },
      {
        ...base,
        author: 'Vorstand',
        id: 'b-4',
        html:
          heading('Trainerfortbildung im Winter') +
          'Termin und Ort folgen. Wer teilnehmen möchte, meldet sich bis Ende des Monats.',
        important: false,
        date: day(-12),
        until: '',
        groups: ['WK', 'G3'],
        roles: ['trainer'],
      },
      {
        ...base,
        id: 'b-5',
        html:
          heading('Sommerfest: Danke!') +
          'Danke an alle, die beim <span style="color:#16a34a;font-size:20px">Sommerfest</span> geholfen haben.',
        important: false,
        date: day(-60),
        until: day(-20),
      },
    ];
  }
}
