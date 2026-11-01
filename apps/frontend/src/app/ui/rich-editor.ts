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
import { Icon, IconName } from './icon';
import { LinkPicker } from './link-picker';
import { cleanHtml } from './rich-text';

type Menu = 'color' | 'mark' | 'link' | 'table' | null;

const MAX_PICTURE_PX = 800;

const MIN_PX = 8;
const MAX_PX = 64;

interface Tool {
  command: string;
  icon: IconName;
  label: string;
}

/** The toolbar is kept short: what is needed for a notice, nothing more. */
const TOOL_GROUPS: readonly { id: string; tools: readonly Tool[] }[] = [
  { id: 'history', tools: [{ command: 'undo', icon: 'undo', label: 'Rückgängig' }] },
  {
    id: 'text',
    tools: [
      { command: 'bold', icon: 'bold', label: 'Fett' },
      { command: 'italic', icon: 'italic', label: 'Kursiv' },
      { command: 'underline', icon: 'underline', label: 'Unterstrichen' },
    ],
  },
  {
    id: 'align',
    tools: [
      { command: 'justifyLeft', icon: 'align-left', label: 'Linksbündig' },
      { command: 'justifyCenter', icon: 'align-center', label: 'Zentriert' },
      { command: 'justifyRight', icon: 'align-right', label: 'Rechtsbündig' },
    ],
  },
  {
    id: 'lists',
    tools: [
      { command: 'insertUnorderedList', icon: 'list-ul', label: 'Aufzählung' },
      { command: 'insertOrderedList', icon: 'list-ol', label: 'Nummerierung' },
    ],
  },
];

/**
 * Small editor for formatted message text: alignment, free font size, bold/italic/underline, text
 * and marker colour in any hex value, and links to the web or to pages of the portal.
 */
@Component({
  selector: 'app-rich-editor',
  imports: [Icon, ColorField, LinkPicker],
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
  protected readonly toolGroups = TOOL_GROUPS;
  protected readonly menu = signal<Menu>(null);
  protected readonly hint = signal('');
  protected readonly textColors = TEXT_COLORS;
  protected readonly markColors = MARK_COLORS;
  protected readonly minPx = MIN_PX;
  protected readonly maxPx = MAX_PX;
  protected readonly link = signal('https://');
  protected readonly tableRows = signal(3);
  protected readonly tableCols = signal(3);

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

  /** A chosen picture is scaled down and embedded, so it needs no upload. */
  protected pictureChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    createImageBitmap(file)
      .then((bitmap) => {
        const scale = Math.min(1, MAX_PICTURE_PX / bitmap.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        this.restore();
        document.execCommand('insertImage', false, canvas.toDataURL('image/jpeg', 0.8));
        this.changed();
      })
      .catch(() => this.hint.set('Dieses Bild konnte nicht gelesen werden.'));
  }

  protected insertTable(): void {
    const rows = Math.min(12, Math.max(1, Math.round(this.tableRows()) || 1));
    const cols = Math.min(8, Math.max(1, Math.round(this.tableCols()) || 1));
    const cell = '<td><br></td>';
    const row = `<tr>${cell.repeat(cols)}</tr>`;
    this.restore();
    document.execCommand(
      'insertHTML',
      false,
      `<table><tbody>${row.repeat(rows)}</tbody></table><p><br></p>`,
    );
    this.menu.set(null);
    this.changed();
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

  protected pageTyped(path: string): void {
    if (path) this.setLink(path);
  }

  protected clearFormat(): void {
    this.restore();
    document.execCommand('removeFormat');
    document.execCommand('unlink');
    this.changed();
  }
}
