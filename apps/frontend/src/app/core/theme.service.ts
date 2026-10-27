import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type ThemeMode = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'themeMode';
const NEXT_MODE: Record<ThemeMode, ThemeMode> = { auto: 'light', light: 'dark', dark: 'auto' };
const LABELS: Record<ThemeMode, string> = {
  auto: '🌓 Auto',
  light: '☀️ Hell',
  dark: '🌙 Dunkel',
};

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

/** Auto, light or dark, stored in the browser like in the Intranet. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  readonly mode = signal<ThemeMode>(readStoredMode());
  readonly label = computed(() => LABELS[this.mode()]);

  constructor() {
    this.apply(this.mode());
  }

  cycle(): void {
    const next = NEXT_MODE[this.mode()];
    this.mode.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be blocked; the choice then only lasts for this visit.
    }
    this.apply(next);
  }

  private apply(mode: ThemeMode): void {
    if (mode === 'auto') this.root.removeAttribute('data-theme');
    else this.root.setAttribute('data-theme', mode);
  }
}
