import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';

const ALLOWED_TAGS = new Set([
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'SPAN',
  'DIV',
  'P',
  'BR',
  'A',
  'S',
  'SUB',
  'SUP',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'HR',
]);
const DROPPED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'TEMPLATE',
  'LINK',
  'META',
]);

const COLOR =
  /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)|[a-z]{3,20})$/i;
const FONT_SIZE = /^(\d{1,2})(\.\d)?px$/i;

const MIN_FONT_PX = 8;
const MAX_FONT_PX = 64;

/** Links may point to the web, to mail and phone, or to a page of this portal ("/personen"). */
const LINK = /^(https?:\/\/|mailto:|tel:|\/(?!\/))/i;

/** The CSS properties a message may carry; everything else is dropped. */
const STYLE_RULES: Record<string, (value: string) => boolean> = {
  color: (value) => COLOR.test(value),
  'background-color': (value) => COLOR.test(value),
  'font-size': (value) => {
    const match = FONT_SIZE.exec(value);
    return !!match && Number(match[1]) >= MIN_FONT_PX && Number(match[1]) <= MAX_FONT_PX;
  },
  'text-align': (value) => /^(left|center|right|justify)$/i.test(value),
  'font-weight': (value) => /^(bold|normal|[1-9]00)$/i.test(value),
  'font-style': (value) => /^(italic|normal)$/i.test(value),
  'text-decoration': (value) => /^(underline|none|line-through)( solid)?$/i.test(value),
  'text-decoration-line': (value) => /^(underline|none|line-through)$/i.test(value),
};

/** True for "#rgb" and "#rrggbb"; used for the free colour inputs. */
export function isHexColor(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function cleanStyle(style: string): string {
  const kept: string[] = [];
  for (const part of style.split(';')) {
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const key = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).trim();
    if (STYLE_RULES[key]?.(value)) kept.push(`${key}:${value}`);
  }
  return kept.join(';');
}

function cleanAttributes(element: Element): void {
  for (const attribute of Array.from(element.attributes)) {
    if (element.tagName === 'A' && attribute.name === 'href') {
      if (!LINK.test(attribute.value.trim())) element.removeAttribute('href');
    } else if (attribute.name === 'style') {
      const style = cleanStyle(attribute.value);
      if (style) element.setAttribute('style', style);
      else element.removeAttribute('style');
    } else {
      element.removeAttribute(attribute.name);
    }
  }
}

function unwrap(element: Element): void {
  element.replaceWith(...Array.from(element.childNodes));
}

function clean(parent: Element): void {
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) continue;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.remove();
      continue;
    }
    const element = node as Element;
    if (DROPPED_TAGS.has(element.tagName)) {
      element.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(element.tagName)) {
      clean(element);
      unwrap(element);
      continue;
    }
    cleanAttributes(element);
    clean(element);
    if (element.tagName !== 'A') continue;
    const href = element.getAttribute('href');
    if (!href) {
      unwrap(element);
    } else if (!href.startsWith('/')) {
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noopener noreferrer');
    }
  }
}

/**
 * Cleans formatted message text: only simple tags, a short list of CSS properties and safe links
 * survive. Angular's own sanitizer would drop the colours and sizes, so this one is used instead.
 */
export function cleanHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  clean(doc.body);
  return doc.body.innerHTML;
}

/** The visible text of formatted message text. */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Turns plain text into simple HTML, one line break per new line. */
export function textToHtml(text: string): string {
  const box = document.createElement('div');
  box.textContent = text;
  return box.innerHTML.replace(/\n/g, '<br>');
}

/** Shows formatted message text. Links to portal pages navigate inside the app. */
@Directive({
  selector: '[appRichText]',
  host: { '(click)': 'follow($event)' },
})
export class RichText {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly router = inject(Router);

  readonly appRichText = input.required<string>();

  constructor() {
    effect(() => {
      this.element.innerHTML = cleanHtml(this.appRichText());
    });
  }

  protected follow(event: MouseEvent): void {
    const link = (event.target as Element).closest('a');
    const href = link?.getAttribute('href');
    if (!href?.startsWith('/')) return;
    event.preventDefault();
    void this.router.navigateByUrl(href);
  }
}
