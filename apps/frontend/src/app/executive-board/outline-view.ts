import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { OutlineItem, parseLetter, parseOutline, segmentsOf } from './outline';

/**
 * The text of minutes (numbered outline) or of a letter (paragraphs), with tables and the names
 * in [square brackets] highlighted.
 */
@Component({
  selector: 'app-outline-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './outline-view.html',
  styleUrl: './outline-view.scss',
})
export class OutlineView {
  readonly text = input.required<string>();
  /** "minutes": every line is a numbered point; "letter": paragraphs separated by a blank line. */
  readonly mode = input<'minutes' | 'letter'>('minutes');

  protected readonly items = computed<OutlineItem[]>(() =>
    this.mode() === 'letter' ? parseLetter(this.text()) : parseOutline(this.text()),
  );
  protected readonly segmentsOf = segmentsOf;
}
