import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { timeout } from 'rxjs';
import { ThemeService } from './core/theme.service';
import { DEMO_ROLES, DemoRole } from './training/training.models';
import { TrainingStore } from './training/training.store';
import { Icon } from './ui/icon';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Icon],
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
