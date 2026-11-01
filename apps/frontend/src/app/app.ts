import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { timeout } from 'rxjs';
import { NAVIGATION, NavAccess } from './core/navigation';
import { ThemeService } from './core/theme.service';
import { DEMO_ROLES, DemoRole } from './training/training.models';
import { TrainingStore } from './training/training.store';
import { Icon } from './ui/icon';
import { ToastHost } from './ui/toast';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Icon, ToastHost],
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly store = inject(TrainingStore);
  protected readonly theme = inject(ThemeService);
  protected readonly demoRoles = DEMO_ROLES;
  protected readonly menuOpen = signal(false);
  protected readonly connectionStatus = signal<'loading' | 'connected' | 'unavailable'>('loading');

  protected readonly collapsed = signal<ReadonlySet<string>>(new Set());

  /** The menu for the current role; sections without any visible entry disappear. */
  protected readonly sections = computed(() => {
    const allowed: Record<NavAccess, boolean> = {
      all: true,
      manage: this.store.canManage(),
      admin: this.store.isAdmin(),
    };
    return NAVIGATION.map((section) => ({
      ...section,
      items: section.items.filter((item) => allowed[item.access]),
    })).filter((section) => section.items.length > 0);
  });

  protected toggleSection(key: string): void {
    this.collapsed.update((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected setRole(event: Event): void {
    this.store.role.set((event.target as HTMLSelectElement).value as DemoRole);
  }

  ngOnInit(): void {
    this.http
      .get<{ status: string }>('/api/health')
      .pipe(timeout(5000), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (health) =>
          this.connectionStatus.set(health.status === 'ok' ? 'connected' : 'unavailable'),
        error: () => this.connectionStatus.set('unavailable'),
      });
  }
}
