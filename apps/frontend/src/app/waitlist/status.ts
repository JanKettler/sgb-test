import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Subscription, distinctUntilChanged, timeout } from 'rxjs';

type RegistrationStatus = 'UNASSIGNED' | 'WAITING' | 'INVITED' | 'TRIAL_COMPLETED';
type Group = 'GROUP_1' | 'GROUP_2' | 'GROUP_3' | 'GROUP_4';
interface PublicStatus {
  status: RegistrationStatus;
  group: Group | null;
  position: number | null;
}

function publicStatus(value: unknown): PublicStatus | null {
  if (!value || typeof value !== 'object') return null;
  if (!('status' in value) || !('group' in value) || !('position' in value)) return null;
  const { status, group, position } = value;
  if (status === 'UNASSIGNED' && group === null && position === null)
    return { status, group, position };
  if (group !== 'GROUP_1' && group !== 'GROUP_2' && group !== 'GROUP_3' && group !== 'GROUP_4')
    return null;
  if (
    status === 'WAITING' &&
    typeof position === 'number' &&
    Number.isSafeInteger(position) &&
    position > 0
  )
    return { status, group, position };
  if ((status === 'INVITED' || status === 'TRIAL_COMPLETED') && position === null)
    return { status, group, position };
  return null;
}

@Component({
  selector: 'app-waitlist-status',
  templateUrl: './status.html',
  styleUrl: './status.scss',
})
export class Status implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private token: string | null = null;
  private request?: Subscription;
  protected readonly state = signal<'loading' | 'ready' | 'unavailable' | 'error' | 'limited'>(
    'loading',
  );
  protected readonly details = signal<PublicStatus | null>(null);
  protected readonly groupLabels: Record<Group, string> = {
    GROUP_1: 'Gruppe 1',
    GROUP_2: 'Gruppe 2',
    GROUP_3: 'Gruppe 3',
    GROUP_4: 'Gruppe 4',
  };
  protected readonly statusLabels: Record<RegistrationStatus, string> = {
    UNASSIGNED: 'Anmeldung eingegangen',
    WAITING: 'Auf der Warteliste',
    INVITED: 'Zum Probetraining eingeladen',
    TRIAL_COMPLETED: 'Probetraining abgeschlossen',
  };

  ngOnInit(): void {
    this.route.fragment
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((fragment) => {
        this.request?.unsubscribe();
        this.token =
          fragment && /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(fragment) ? fragment : null;
        this.load();
      });
  }

  private load(): void {
    this.details.set(null);
    if (!this.token) {
      this.state.set('unavailable');
      return;
    }
    this.state.set('loading');
    this.request = this.http
      .post<unknown>(
        '/api/public/waitlist/status',
        { token: this.token },
        {
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          credentials: 'omit',
        },
      )
      .pipe(timeout(10000), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const details = publicStatus(response);
          this.details.set(details);
          this.state.set(details ? 'ready' : 'error');
        },
        error: (error: unknown) => {
          this.state.set(
            error instanceof HttpErrorResponse && error.status === 404
              ? 'unavailable'
              : error instanceof HttpErrorResponse && error.status === 429
                ? 'limited'
                : 'error',
          );
        },
      });
  }
}
