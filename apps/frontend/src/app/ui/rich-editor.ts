import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  model,
  signal,
  viewChild,
  input,
} from '@angular/core';
import { ColorField, MARK_COLORS, TEXT_COLORS } from './color-field';
import { Icon } from './icon';
import { INTERNAL_PAGES } from './internal-pages';
import { cleanHtml } from './rich-text';

type Menu = 'color' | 'mark' | 'link' | null;

const MIN_PX = 8;
const MAX_PX = 64;
const PRESET_SIZES = [12, 16, 22, 30];

/**
 * Small editor for formatted message text: alignment, free font size, bold/italic/underline, text
 * and marker colour in any hex value, and links to the web or to pages of the portal.
 */
@Component({
  selector: 'app-rich-editor',
  imports: [Icon, ColorField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rich-editor.html',
  styleUrl: './rich-editor.scss',
  host: { '(document:selectionchange)': 'remember()' },
})
export class RichEditor {
  /** The formatted text as cleaned HTML. */
  readonly html = model('');
  /** Background of the whole entry, shown behind the text while editing. */
  readonly background = input('');
  readonly textColor = input('');

  protected readonly area = viewChild<ElementRef<HTMLElement>>('area');
  protected readonly menu = signal<Menu>(null);
  protected readonly hint = signal('');
  protected readonly textColors = TEXT_COLORS;
  protected readonly markColors = MARK_COLORS;
  protected readonly presets = PRESET_SIZES;
  protected readonly pages = INTERNAL_PAGES;
  protected readonly minPx = MIN_PX;
  protected readonly maxPx = MAX_PX;
  protected readonly link = signal('https://');

  private saved: Range | null = null;

  constructor() {
    effect(() => {
      const element = this.area()?.nativeElement;
      if (!element) return;
      const wanted = cleanHtml(this.html());
      if (wanted !== cleanHtml(element.innerHTML)) element.innerHTML = wanted;
    });
  }

  protected remember(): void {
    const element = this.area()?.nativeElement;
    const selection = window.getSelection();
    if (!element || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (element.contains(range.commonAncestorContainer)) this.saved = range.cloneRange();
  }

  /** Keeps the text selection while a toolbar button is tapped. */
  protected keepSelection(event: MouseEvent): void {
    if ((event.target as Element).closest('button')) event.preventDefault();
  }

  protected toggle(menu: Exclude<Menu, null>): void {
    this.menu.update((current) => (current === menu ? null : menu));
    this.hint.set('');
  }

  protected changed(): void {
    const element = this.area()?.nativeElement;
    if (!element) return;
    const text = (element.textContent ?? '').trim();
    this.html.set(text || element.querySelector('a') ? cleanHtml(element.innerHTML) : '');
  }

  protected paste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
  }

  private restore(): HTMLElement | null {
    const element = this.area()?.nativeElement ?? null;
    if (!element) return null;
    element.focus();
    const selection = window.getSelection();
    if (this.saved && selection) {
      selection.removeAllRanges();
      selection.addRange(this.saved);
    }
    return element;
  }

  private needsSelection(): boolean {
    const missing = !this.saved || this.saved.collapsed;
    this.hint.set(missing ? 'Erst den Text markieren, der geändert werden soll.' : '');
    return missing;
  }

  protected command(name: string): void {
    this.restore();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(name, false);
    this.changed();
  }

  protected setColor(kind: 'foreColor' | 'hiliteColor', color: string): void {
    if (this.needsSelection()) return;
    const element = this.restore();
    document.execCommand('styleWithCSS', false, 'true');
    if (kind === 'foreColor') {
      // "No colour" means the normal text colour of the editor.
      document.execCommand(kind, false, color || getComputedStyle(element ?? document.body).color);
    } else if (!document.execCommand(kind, false, color || 'transparent')) {
      document.execCommand('backColor', false, color || 'transparent');
    }
    this.changed();
  }

  /** Any size in pixels: the browser marks the text with a placeholder size that is swapped here. */
  protected setSize(value: number): void {
    if (!Number.isFinite(value) || this.needsSelection()) return;
    const size = Math.min(MAX_PX, Math.max(MIN_PX, Math.round(value)));
    const element = this.restore();
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand('fontSize', false, '7');
    element?.querySelectorAll('font[size="7"]').forEach((font) => {
      const span = document.createElement('span');
      span.style.fontSize = `${size}px`;
      span.append(...Array.from(font.childNodes));
      font.replaceWith(span);
    });
    this.changed();
  }

  protected sizeTyped(event: Event): void {
    this.setSize(Number((event.target as HTMLInputElement).value));
  }

  protected setLink(href: string): void {
    const target = href.trim();
    if (!/^(https?:\/\/|mailto:|tel:|\/(?!\/))/i.test(target) || target === 'https://') {
      this.hint.set('Bitte eine Adresse wie https://… eingeben oder eine Seite wählen.');
      return;
    }
    if (this.needsSelection()) return;
    this.restore();
    document.execCommand('createLink', false, target);
    this.menu.set(null);
    this.changed();
  }

  protected pageTyped(event: Event): void {
    const path = (event.target as HTMLSelectElement).value;
    if (path) this.setLink(path);
  }

  protected clearFormat(): void {
    this.restore();
    document.execCommand('removeFormat');
    document.execCommand('unlink');
    this.changed();
  }
}
