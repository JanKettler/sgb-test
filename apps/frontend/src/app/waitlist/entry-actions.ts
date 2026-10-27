import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface HistoryEntry {
  id: string;
  type: 'REGISTERED' | 'GROUP_ASSIGNED' | 'GROUP_CHANGED' | 'POSITION_CHANGED' | 'STATUS_LINK_SENT';
  previousGroup: string | null;
  group: string | null;
  previousPosition: number | null;
  newPosition: number | null;
  reason: string | null;
  createdAt: string;
}
interface Details {
  internalNotes: string | null;
  history: HistoryEntry[];
  groupHistoryIncomplete: boolean;
  statusLinkDelivery: {
    status: 'NONE' | 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'UNKNOWN';
    attemptedAt: string | null;
    sentAt: string | null;
    canSend: boolean;
  };
}

@Component({
  selector: 'app-waitlist-entry-actions',
  imports: [DatePipe],
  templateUrl: './entry-actions.html',
})
export class EntryActions implements OnInit {
  readonly entryId = input.required<string>();
  readonly changed = output<string>();
  readonly busy = output<boolean>();
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly details = signal<Details | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly deliveryMessage = signal('');
  protected readonly refreshingDelivery = signal(false);

  protected reloadDelivery(): void {
    if (this.refreshingDelivery()) return;
    this.refreshingDelivery.set(true);
    this.http
      .get<Details>(`/api/internal/waitlist/${this.entryId()}/details`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (details) => {
          this.details.update((current) =>
            current
              ? {
                  ...current,
                  statusLinkDelivery: details.statusLinkDelivery,
                  history: details.history,
                }
              : current,
          );
          this.refreshingDelivery.set(false);
        },
        error: () => {
          this.refreshingDelivery.set(false);
          this.error.set('Der Versandstatus konnte nicht aktualisiert werden.');
        },
      });
  }

  protected sendStatusLink(): void {
    if (this.saving() || this.refreshingDelivery() || !this.details()?.statusLinkDelivery.canSend)
      return;
    this.saving.set(true);
    this.busy.emit(true);
    this.error.set('');
    this.deliveryMessage.set('');
    this.http
      .post<{ status: 'sent' | 'failed' }>(
        `/api/internal/waitlist/${this.entryId()}/status-link`,
        {},
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.saving.set(false);
          this.busy.emit(false);
          this.details.update((current) =>
            current
              ? {
                  ...current,
                  statusLinkDelivery: {
                    ...current.statusLinkDelivery,
                    status: response.status === 'sent' ? 'SENT' : 'FAILED',
                    canSend: false,
                  },
                }
              : current,
          );
          this.deliveryMessage.set(
            response.status === 'sent'
              ? 'Die Mail mit dem Statuslink wurde vom Mailserver angenommen.'
              : 'Der Versand wurde nicht bestätigt. Du kannst ihn erneut versuchen.',
          );
          this.reloadDelivery();
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          this.busy.emit(false);
          this.details.update((current) =>
            current
              ? {
                  ...current,
                  statusLinkDelivery: { ...current.statusLinkDelivery, canSend: false },
                }
              : current,
          );
          this.error.set(
            error.status === 409
              ? 'Ein Versand läuft bereits oder ist nicht mehr möglich. Bitte aktualisiere den Versandstatus.'
              : 'Der Versand konnte nicht abgeschlossen werden. Bitte aktualisiere den Versandstatus.',
          );
          this.reloadDelivery();
        },
      });
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.http
      .get<Details>(`/api/internal/waitlist/${this.entryId()}/details`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (details) => {
          this.details.set(details);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Die internen Angaben konnten nicht geladen werden.');
        },
      });
  }

  protected saveNotes(notes: string): void {
    if (notes.trim().length > 5000) {
      this.error.set('Interne Notizen dürfen höchstens 5.000 Zeichen enthalten.');
      return;
    }
    this.save('notes', { internalNotes: notes.trim() }, 'Die internen Notizen wurden gespeichert.');
  }

  private save(path: string, body: object, message: string): void {
    if (this.saving() || !this.details()) return;
    this.saving.set(true);
    this.busy.emit(true);
    this.error.set('');
    this.http
      .patch(`/api/internal/waitlist/${this.entryId()}/${path}`, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.busy.emit(false);
          this.changed.emit(message);
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          this.busy.emit(false);
          this.error.set(
            error.status === 409
              ? 'Die Warteliste wurde zwischenzeitlich geändert. Bitte lade die Liste neu.'
              : 'Die Änderung konnte nicht gespeichert werden. Bitte prüfe deine Angaben und versuche es erneut.',
          );
        },
      });
  }
}
