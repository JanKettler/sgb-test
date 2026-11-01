import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon, IconName } from './icon';

export type ActionKind =
  | 'add'
  | 'edit'
  | 'delete'
  | 'copy'
  | 'save'
  | 'cancel'
  | 'back'
  | 'download'
  | 'print'
  | 'excel'
  | 'lend'
  | 'return'
  | 'done'
  | 'stock'
  | 'expand'
  | 'collapse';

export interface ActionLook {
  icon: IconName;
  /** Default accessible name and, with `withText`, the visible text. */
  label: string;
  /** Bulma colour class; empty for the neutral button. */
  tone: string;
}

/** One look per action, so that the same action looks the same on every page. */
export const ACTIONS: Readonly<Record<ActionKind, ActionLook>> = {
  add: { icon: 'plus', label: 'Hinzufügen', tone: 'is-success' },
  edit: { icon: 'pencil', label: 'Bearbeiten', tone: 'is-warning' },
  delete: { icon: 'trash', label: 'Löschen', tone: 'is-danger' },
  copy: { icon: 'copy', label: 'Kopieren', tone: '' },
  save: { icon: 'save', label: 'Speichern', tone: 'is-success' },
  cancel: { icon: 'x', label: 'Abbrechen', tone: 'is-danger' },
  back: { icon: 'chevron-left', label: 'Zurück', tone: '' },
  download: { icon: 'download', label: 'Herunterladen', tone: '' },
  print: { icon: 'print', label: 'Drucken', tone: '' },
  excel: { icon: 'sheet', label: 'Excel', tone: '' },
  lend: { icon: 'handshake', label: 'Verleihen', tone: 'is-link' },
  return: { icon: 'restore', label: 'Rückgabe', tone: 'is-info' },
  done: { icon: 'check', label: 'Erledigt', tone: 'is-success' },
  stock: { icon: 'box', label: 'Bestand ändern', tone: '' },
  expand: { icon: 'chevron-down', label: 'Details anzeigen', tone: '' },
  collapse: { icon: 'chevron-up', label: 'Details ausblenden', tone: '' },
};

/**
 * The button for the recurring actions: add, edit, delete, copy, save, cancel, back, download,
 * print, Excel, lend, return, done, stock, expand and collapse. Icon only by default (with the name as tooltip and for screen readers); with
 * `withText` the name is shown next to the icon. With `link` it renders a router link instead.
 */
@Component({
  selector: 'app-action',
  imports: [Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (link(); as target) {
      <a [class]="classes()" [routerLink]="target" [attr.aria-label]="name()" [title]="name()">
        <app-icon [name]="look().icon" />
        @if (withText()) {
          <span>{{ name() }}</span>
        }
      </a>
    } @else {
      <button
        [type]="submit() ? 'submit' : 'button'"
        [class]="classes()"
        [disabled]="disabled()"
        [attr.aria-label]="name()"
        [title]="name()"
        (click)="pressed.emit($event)"
      >
        <app-icon [name]="look().icon" />
        @if (withText()) {
          <span>{{ name() }}</span>
        }
      </button>
    }
  `,
})
export class Action {
  readonly kind = input.required<ActionKind>();
  /** More precise name, e.g. "Termin bearbeiten"; defaults to the name of the action. */
  readonly label = input('');
  readonly withText = input(false, { transform: booleanAttribute });
  readonly small = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  /** A submit button for forms; otherwise the button never submits. */
  readonly submit = input(false, { transform: booleanAttribute });
  /** Target of a router link; without it the button emits `pressed`. */
  readonly link = input<string | readonly unknown[] | null>(null);
  readonly pressed = output<MouseEvent>();

  protected readonly look = computed(() => ACTIONS[this.kind()]);
  protected readonly name = computed(() => this.label() || this.look().label);
  protected readonly classes = computed(() =>
    ['button', this.look().tone, this.small() ? 'is-small' : ''].filter(Boolean).join(' '),
  );
}
