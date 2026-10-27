import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type IconName =
  | 'check'
  | 'x'
  | 'minus'
  | 'plus'
  | 'users'
  | 'clipboard'
  | 'pencil'
  | 'copy'
  | 'trash'
  | 'download'
  | 'mail'
  | 'calendar'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'eye-slash'
  | 'chevron-down'
  | 'home'
  | 'gear'
  | 'warning'
  | 'list'
  | 'sheet'
  | 'save';

const FONT_AWESOME: Record<IconName, string> = {
  check: 'fa-check',
  x: 'fa-xmark',
  minus: 'fa-minus',
  plus: 'fa-plus',
  users: 'fa-user-group',
  clipboard: 'fa-clipboard-list',
  pencil: 'fa-pen',
  copy: 'fa-copy',
  trash: 'fa-trash',
  download: 'fa-download',
  mail: 'fa-envelope',
  calendar: 'fa-calendar-days',
  'chevron-left': 'fa-chevron-left',
  'chevron-right': 'fa-chevron-right',
  'chevron-up': 'fa-chevron-up',
  'eye-slash': 'fa-eye-slash',
  'chevron-down': 'fa-chevron-down',
  home: 'fa-house',
  gear: 'fa-gear',
  warning: 'fa-triangle-exclamation',
  list: 'fa-list',
  sheet: 'fa-table',
  save: 'fa-floppy-disk',
};

/**
 * Font Awesome icons behind one component. Keeping all icons in one place makes it easy to switch to
 * Font Awesome later without touching the pages.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon.html',
})
export class Icon {
  readonly name = input.required<IconName>();
  protected readonly cssClass = computed(() => `app-icon fa-solid ${FONT_AWESOME[this.name()]}`);
}
