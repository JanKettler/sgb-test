import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DateField } from '../ui/date-field';
import { Icon } from '../ui/icon';
import { ModalDialog } from '../ui/modal-dialog';
import { fullDate } from '../training/training-dates';
import { GROUPS, GroupId } from '../training/training.models';
import { BoardPost } from './board.models';
import { BoardStore } from './board.store';

/** The notice board: a short list on the start page, the full list with archive on its own page. */
@Component({
  selector: 'app-board',
  imports: [RouterLink, Icon, ModalDialog, DateField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board.html',
})
export class Board {
  protected readonly store = inject(BoardStore);
  protected readonly groups = GROUPS;
  protected readonly fullDate = fullDate;

  /** Shows only the first messages and a link to the full page. */
  readonly limit = input(0);

  protected readonly shown = computed(() => {
    const list = this.store.live();
    return this.limit() > 0 ? list.slice(0, this.limit()) : list;
  });
  protected readonly more = computed(() => this.store.live().length - this.shown().length);

  protected readonly draft = signal<BoardPost | null>(null);
  protected readonly invalid = signal(false);
  protected readonly toDelete = signal<BoardPost | null>(null);

  protected groupText(ids: GroupId[]): string {
    return ids.map((id) => this.groups.find((group) => group.id === id)?.name ?? id).join(', ');
  }

  /** The arrows only work between messages of the same importance. */
  protected canMove(post: BoardPost, step: -1 | 1): boolean {
    const list = this.store.live();
    const other = list[list.findIndex((item) => item.id === post.id) + step];
    return !!other && other.important === post.important;
  }

  protected add(): void {
    this.invalid.set(false);
    this.draft.set(this.store.newPost());
  }

  protected edit(post: BoardPost): void {
    this.invalid.set(false);
    this.draft.set({ ...post, groups: [...post.groups] });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected set(key: 'title' | 'text', event: Event): void {
    const value = this.value(event);
    this.draft.update((post) => (post ? { ...post, [key]: value } : post));
  }

  protected setImportant(important: boolean): void {
    this.draft.update((post) => (post ? { ...post, important } : post));
  }

  protected setUntil(until: string): void {
    this.draft.update((post) => (post ? { ...post, until } : post));
  }

  protected toggleGroup(id: GroupId): void {
    this.draft.update((post) => {
      if (!post) return post;
      const has = post.groups.includes(id);
      return { ...post, groups: has ? post.groups.filter((g) => g !== id) : [...post.groups, id] };
    });
  }

  protected save(): void {
    const post = this.draft();
    if (!post) return;
    if (!post.title.trim()) {
      this.invalid.set(true);
      return;
    }
    this.store.save(post);
    this.draft.set(null);
  }

  protected remove(): void {
    const post = this.toDelete();
    if (post) this.store.remove(post.id);
    this.toDelete.set(null);
  }
}
