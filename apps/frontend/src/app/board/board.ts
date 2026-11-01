import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { fullDate } from '../training/training-dates';
import { DEMO_ROLES, DemoRole, GROUPS, GroupId } from '../training/training.models';
import { BACKGROUND_COLORS, ColorField, readableOn } from '../ui/color-field';
import { DateField } from '../ui/date-field';
import { Icon } from '../ui/icon';
import { ModalDialog } from '../ui/modal-dialog';
import { RichEditor } from '../ui/rich-editor';
import { RichText, htmlToText } from '../ui/rich-text';
import { ArchiveEntry, BoardPost, titleOf } from './board.models';
import { BoardStore } from './board.store';

const SEEN_AFTER_MS = 15000;

/** The notice board: a short list on the start page, the full list with archive on its own page. */
@Component({
  selector: 'app-board',
  imports: [RouterLink, Icon, ModalDialog, DateField, RichEditor, RichText, ColorField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board.html',
  styleUrl: './board.scss',
})
export class Board {
  protected readonly store = inject(BoardStore);
  protected readonly groups = GROUPS;
  protected readonly roles = DEMO_ROLES;
  protected readonly backgrounds = BACKGROUND_COLORS;
  protected readonly fullDate = fullDate;
  protected readonly titleOf = titleOf;

  /** Shows only the first messages and a link to the full page. */
  readonly limit = input(0);

  protected readonly shown = computed(() => {
    const list = this.store.live();
    return this.limit() > 0 ? list.slice(0, this.limit()) : list;
  });
  protected readonly more = computed(() => this.store.live().length - this.shown().length);

  protected readonly draft = signal<BoardPost | null>(null);
  protected readonly creating = computed(
    () => !this.store.posts().some((post) => post.id === this.draft()?.id),
  );
  protected readonly invalid = signal(false);
  protected readonly toDelete = signal<BoardPost | null>(null);

  constructor() {
    // "New" counts as seen once the full page was open for a while or is left.
    const timer = setTimeout(() => this.markSeen(), SEEN_AFTER_MS);
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(timer);
      this.markSeen();
    });
  }

  private markSeen(): void {
    if (this.limit() === 0) this.store.markSeen();
  }

  protected audience(post: BoardPost): string {
    const groups = post.groups.map((id) => GROUPS.find((group) => group.id === id)?.name ?? id);
    const roles = post.roles.map((id) => DEMO_ROLES.find((role) => role.id === id)?.label ?? id);
    return [...groups, ...roles].join(', ');
  }

  protected day(iso: string): string {
    return fullDate(iso);
  }

  protected ink(post: BoardPost): string | null {
    return post.bg ? readableOn(post.bg) : null;
  }

  protected add(): void {
    this.invalid.set(false);
    this.draft.set(this.store.newPost());
  }

  protected inArchive(entry: ArchiveEntry): boolean {
    return entry.reason === 'deleted';
  }

  protected edit(post: BoardPost): void {
    this.invalid.set(false);
    this.draft.set({ ...post, groups: [...post.groups], roles: [...post.roles] });
  }

  protected patch(change: Partial<BoardPost>): void {
    this.draft.update((post) => (post ? { ...post, ...change } : post));
  }

  protected setAuthor(event: Event): void {
    this.patch({ author: (event.target as HTMLInputElement).value });
  }

  protected toggleGroup(id: GroupId): void {
    const post = this.draft();
    if (!post) return;
    const groups = post.groups.includes(id)
      ? post.groups.filter((group) => group !== id)
      : [...post.groups, id];
    this.patch({ groups });
  }

  protected toggleRole(id: DemoRole): void {
    const post = this.draft();
    if (!post) return;
    const roles = post.roles.includes(id)
      ? post.roles.filter((role) => role !== id)
      : [...post.roles, id];
    this.patch({ roles });
  }

  protected save(): void {
    const post = this.draft();
    if (!post) return;
    if (!htmlToText(post.html)) {
      this.invalid.set(true);
      return;
    }
    this.store.save({ ...post, author: post.author.trim() || this.store.author });
    this.draft.set(null);
  }

  protected remove(): void {
    const post = this.toDelete();
    if (post) this.store.remove(post.id);
    this.toDelete.set(null);
  }
}
