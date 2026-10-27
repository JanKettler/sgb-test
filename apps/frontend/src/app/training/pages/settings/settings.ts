import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Icon } from '../../../ui/icon';
import { NameDialog } from '../../dialogs/name-dialog';
import { TemplateDialog } from '../../dialogs/template-dialog';
import { GroupDefaults, GroupId, MailTemplate, OTHER_REASON, Venue } from '../../training.models';
import { SettingsSnapshot, TrainingStore } from '../../training.store';

const NEW_TEMPLATE: MailTemplate = { id: '', name: '', subject: '', text: '' };

/** Dialog state: a venue to edit, a new one, or nothing. */
type VenueEdit = Venue | 'new' | null;
type ReasonEdit = string | 'new' | null;

@Component({
  selector: 'app-training-settings',
  imports: [Icon, NameDialog, TemplateDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class TrainingSettings {
  protected readonly store = inject(TrainingStore);
  protected readonly other = OTHER_REASON;

  protected readonly editing = signal(false);
  private snapshot: SettingsSnapshot | null = null;

  protected readonly groupId = signal<GroupId>('G1');
  protected readonly message = signal('');
  protected readonly venueEdit = signal<VenueEdit>(null);
  protected readonly reasonEdit = signal<ReasonEdit>(null);
  protected readonly templateEdit = signal<MailTemplate | null>(null);

  protected readonly defaults = computed(() => this.store.defaults()[this.groupId()]);

  protected startEdit(): void {
    this.snapshot = this.store.settingsSnapshot();
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    if (this.snapshot) this.store.restoreSettings(this.snapshot);
    this.snapshot = null;
    this.editing.set(false);
    this.message.set('Änderungen verworfen.');
  }

  protected saveEdit(): void {
    this.snapshot = null;
    this.editing.set(false);
    this.message.set('Einstellungen gespeichert.');
  }

  protected changeSeason(step: number): void {
    this.store.season.update((year) => year + step);
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }

  protected setDefault(change: Partial<GroupDefaults>): void {
    this.store.updateDefaults(this.groupId(), change);
  }

  protected toggleTrainer(trainerId: string): void {
    const current = this.defaults().trainerIds;
    this.setDefault({
      trainerIds: current.includes(trainerId)
        ? current.filter((id) => id !== trainerId)
        : [...current, trainerId],
    });
  }

  protected saveVenue(name: string): void {
    const edit = this.venueEdit();
    if (edit === 'new') this.store.addVenue(name);
    else if (edit) this.store.renameVenue(edit.id, name);
    this.venueEdit.set(null);
  }

  protected deleteVenue(): void {
    const edit = this.venueEdit();
    if (edit && edit !== 'new') {
      this.message.set(
        this.store.deleteVenue(edit.id)
          ? 'Der Ort wurde gelöscht.'
          : 'Der Ort wird noch von Terminen oder Standardwerten verwendet.',
      );
    }
    this.venueEdit.set(null);
  }

  protected saveReason(name: string): void {
    const edit = this.reasonEdit();
    if (edit && edit !== 'new') this.store.removeReason(edit);
    this.store.addReason(name);
    this.reasonEdit.set(null);
  }

  protected deleteReason(): void {
    const edit = this.reasonEdit();
    if (edit && edit !== 'new') this.store.removeReason(edit);
    this.reasonEdit.set(null);
  }

  protected newTemplate(): void {
    this.templateEdit.set({ ...NEW_TEMPLATE });
  }

  protected saveTemplate(template: MailTemplate): void {
    this.store.saveTemplate(template);
    this.templateEdit.set(null);
  }

  protected deleteTemplate(): void {
    const template = this.templateEdit();
    if (template) this.store.deleteTemplate(template.id);
    this.templateEdit.set(null);
  }
}
