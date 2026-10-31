import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { Icon, IconName } from './icon';

export type ToastKind = 'ok' | 'info' | 'bad';

interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
}

const SHOW_MS = 3200;

/** Small confirmations at the bottom of the screen: saved, cancelled, failed. */
@Injectable({ providedIn: 'root' })
export class Toasts {
  readonly items = signal<ToastItem[]>([]);
  private counter = 0;

  show(text: string, kind: ToastKind = 'ok'): void {
    const id = ++this.counter;
    this.items.update((list) => [...list.slice(-2), { id, text, kind }]);
    setTimeout(() => this.dismiss(id), SHOW_MS);
  }

  saved(what = 'Gespeichert'): void {
    this.show(what, 'ok');
  }

  cancelled(what = 'Abgebrochen'): void {
    this.show(what, 'info');
  }

  failed(what = 'Das hat nicht geklappt'): void {
    this.show(what, 'bad');
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((item) => item.id !== id));
  }
}

const ICON: Record<ToastKind, IconName> = { ok: 'check', info: 'info', bad: 'warning' };

@Component({
  selector: 'app-toasts',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite">
      @for (item of toasts.items(); track item.id) {
        <button
          type="button"
          class="toast"
          [class]="'toast is-' + item.kind"
          (click)="toasts.dismiss(item.id)"
        >
          <app-icon [name]="icon[item.kind]" /> {{ item.text }}
        </button>
      }
    </div>
  `,
  styles: `
    .toasts {
      bottom: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      left: 50%;
      pointer-events: none;
      position: fixed;
      transform: translateX(-50%);
      z-index: 200;
    }

    .toast {
      align-items: center;
      background: #34495e;
      border: 0;
      border-radius: 999px;
      box-shadow: 0 4px 14px rgb(0 0 0 / 28%);
      color: #fff;
      cursor: pointer;
      display: inline-flex;
      font-size: 0.9rem;
      font-weight: 600;
      gap: 0.45rem;
      padding: 0.45rem 1rem;
      pointer-events: auto;

      &.is-ok {
        background: #1d7a46;
      }

      &.is-bad {
        background: #b3261e;
      }

      &.is-info {
        background: #34495e;
      }
    }
  `,
})
export class ToastHost {
  protected readonly toasts = inject(Toasts);
  protected readonly icon = ICON;
}
