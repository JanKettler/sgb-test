import { Component, input } from '@angular/core';

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
  | 'home'
  | 'gear'
  | 'warning'
  | 'list';

/**
 * Small inline SVG icon set. Keeping all icons in one place makes it easy to switch to
 * Font Awesome later without touching the pages.
 */
@Component({
  selector: 'app-icon',
  templateUrl: './icon.html',
})
export class Icon {
  readonly name = input.required<IconName>();
}
