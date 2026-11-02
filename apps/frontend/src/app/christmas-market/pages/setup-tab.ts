import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Action } from '../../ui/action';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { FieldDef, FormDialog, FormValues, textOf } from '../../ui/form-dialog';
import { Toasts } from '../../ui/toast';
import { Note, Phase, Step } from '../market.models';
import { MarketStore } from '../market.store';

const PHASES: readonly Phase[] = ['aufbau', 'abbau'];

const PHASE_NAME: Readonly<Record<Phase, string>> = {
  aufbau: 'Aufbau',
  abbau: 'Abbau',
};

const STEP_FORM: readonly FieldDef[] = [
  { key: 'time', label: 'Uhrzeit', type: 'time' },
  { key: 'title', label: 'Was ist zu tun?', required: true },
  { key: 'text', label: 'Genauer', type: 'textarea', rows: 3 },
];

const NOTE_FORM: readonly FieldDef[] = [
  { key: 'title', label: 'Überschrift', required: true },
  { key: 'text', label: 'Text', type: 'textarea', rows: 5 },
];

/** The checklists for setting up and taking down the stand, and the notes for the helpers. */
@Component({
  selector: 'app-market-setup',
  imports: [Action, ConfirmDialog, FormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './setup-tab.html',
})
export class SetupTab {
  protected readonly store = inject(MarketStore);
  private readonly toasts = inject(Toasts);

  protected readonly phases = PHASES;
  protected readonly phaseName = PHASE_NAME;
  protected readonly stepForm = STEP_FORM;
  protected readonly noteForm = NOTE_FORM;

  protected readonly editingStep = signal<Step | null>(null);
  protected readonly stepToDelete = signal<Step | null>(null);
  protected readonly editingNote = signal<Note | null>(null);
  protected readonly noteToDelete = signal<Note | null>(null);

  protected doneCount(phase: Phase): number {
    return this.store.stepsOf(phase).filter((step) => step.done).length;
  }

  protected addStep(phase: Phase): void {
    this.editingStep.set(this.store.newStep(phase));
  }

  protected saveStep(values: FormValues): void {
    const step = this.editingStep();
    if (!step) return;
    const problem = this.store.saveStep({
      ...step,
      time: textOf(values, 'time'),
      title: textOf(values, 'title'),
      text: textOf(values, 'text'),
    });
    if (problem) this.toasts.failed(problem);
    else {
      this.toasts.saved();
      this.editingStep.set(null);
    }
  }

  protected removeStep(): void {
    const step = this.stepToDelete();
    if (step) {
      this.store.removeStep(step.id);
      this.toasts.saved('Schritt gelöscht');
    }
    this.stepToDelete.set(null);
  }

  protected suggest(): void {
    this.store.addStandardAbbau();
    this.toasts.saved('Vorschlag eingefügt');
  }

  protected addNote(): void {
    this.editingNote.set(this.store.newNote());
  }

  protected saveNote(values: FormValues): void {
    const note = this.editingNote();
    if (!note) return;
    const problem = this.store.saveNote({
      ...note,
      title: textOf(values, 'title'),
      text: textOf(values, 'text'),
    });
    if (problem) this.toasts.failed(problem);
    else {
      this.toasts.saved();
      this.editingNote.set(null);
    }
  }

  protected removeNote(): void {
    const note = this.noteToDelete();
    if (note) {
      this.store.removeNote(note.id);
      this.toasts.saved('Hinweis gelöscht');
    }
    this.noteToDelete.set(null);
  }
}
