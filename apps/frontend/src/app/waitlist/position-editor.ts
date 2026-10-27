import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-waitlist-position-editor',
  templateUrl: './position-editor.html',
  styleUrl: './position-editor.scss',
})
export class PositionEditor {
  readonly entryId = input.required<string>();
  readonly group = input.required<string>();
  readonly position = input.required<number>();
  readonly queueLength = input.required<number>();
  readonly disabled = input(false);
  readonly busy = output<boolean>();
  readonly changed = output<string>();
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly form = viewChild.required<ElementRef<HTMLFormElement>>('moveForm');
  private readonly target = viewChild.required<ElementRef<HTMLInputElement>>('target');
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  protected open(): void {
    this.error.set('');
    this.form().nativeElement.reset();
    this.target().nativeElement.value = String(this.position());
    this.dialog().nativeElement.showModal();
  }

  protected close(event?: Event): void {
    if (this.saving()) {
      event?.preventDefault();
      return;
    }
    this.dialog().nativeElement.close();
  }

  protected move(positionValue: string, reasonValue: string): void {
    if (this.saving()) return;
    const position = Number(positionValue);
    const reason = reasonValue.trim();
    if (
      !Number.isInteger(position) ||
      position < 1 ||
      position > this.queueLength() ||
      position === this.position()
    ) {
      this.error.set('Bitte wähle einen anderen gültigen Warteplatz innerhalb dieser Gruppe.');
      return;
    }
    if (!reason || reason.length > 2000) {
      this.error.set('Bitte gib eine Begründung mit höchstens 2.000 Zeichen ein.');
      return;
    }
    this.saving.set(true);
    this.busy.emit(true);
    this.error.set('');
    this.http
      .patch(`/api/internal/waitlist/${this.entryId()}/position`, {
        group: this.group(),
        previousPosition: this.position(),
        position,
        reason,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.busy.emit(false);
          this.close();
          this.changed.emit('Der Warteplatz wurde geändert.');
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          this.busy.emit(false);
          this.error.set(
            error.status === 409
              ? 'Die Warteliste wurde zwischenzeitlich geändert. Bitte schließe den Dialog und lade die Liste neu.'
              : 'Die Änderung konnte nicht gespeichert werden. Bitte prüfe deine Angaben und versuche es erneut.',
          );
        },
      });
  }
}
