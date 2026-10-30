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
  | 'coins'
  | 'pin'
  | 'lock'
  | 'chevron-down'
  | 'home'
  | 'gear'
  | 'warning'
  | 'list'
  | 'sheet'
  | 'save'
  | 'sun'
  | 'moon'
  | 'cloud-sun'
  | 'flag'
  | 'tasks'
  | 'info'
  | 'hourglass'
  | 'tree'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'highlighter'
  | 'palette'
  | 'link'
  | 'eraser'
  | 'bullhorn'
  | 'bolt'
  | 'arrow-right'
  | 'swim'
  | 'restore';

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
  coins: 'fa-coins',
  pin: 'fa-thumbtack',
  lock: 'fa-lock',
  'chevron-down': 'fa-chevron-down',
  home: 'fa-house',
  gear: 'fa-gear',
  warning: 'fa-triangle-exclamation',
  list: 'fa-list',
  sheet: 'fa-table',
  save: 'fa-floppy-disk',
  sun: 'fa-sun',
  moon: 'fa-moon',
  'cloud-sun': 'fa-cloud-sun',
  flag: 'fa-flag-checkered',
  tasks: 'fa-list-check',
  info: 'fa-circle-info',
  hourglass: 'fa-hourglass-half',
  tree: 'fa-tree',
  bold: 'fa-bold',
  italic: 'fa-italic',
  underline: 'fa-underline',
  'align-left': 'fa-align-left',
  'align-center': 'fa-align-center',
  'align-right': 'fa-align-right',
  highlighter: 'fa-highlighter',
  palette: 'fa-palette',
  link: 'fa-link',
  eraser: 'fa-eraser',
  bullhorn: 'fa-bullhorn',
  bolt: 'fa-bolt',
  'arrow-right': 'fa-arrow-right',
  swim: 'fa-person-swimming',
  restore: 'fa-rotate-left',
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
