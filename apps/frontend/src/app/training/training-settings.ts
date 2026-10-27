import { Component, inject, signal } from '@angular/core';
import { Icon } from './icon';
import { DECLINE_REASONS, GroupDefaults, GroupId } from './training.models';
import { TrainingStore } from './training.store';

@Component({
  selector: 'app-training-settings',
  imports: [Icon],
  templateUrl: './training-settings.html',
})
export class TrainingSettings {
  protected readonly store = inject(TrainingStore);
  protected readonly reasons = DECLINE_REASONS;
  protected readonly message = signal('');
  protected readonly newVenue = signal('');

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }

  protected setDefault(groupId: GroupId, change: Partial<GroupDefaults>): void {
    this.store.updateDefaults(groupId, change);
  }

  protected toggleTrainer(groupId: GroupId, trainerId: string): void {
    const current = this.store.defaults()[groupId].trainerIds;
    this.setDefault(groupId, {
      trainerIds: current.includes(trainerId)
        ? current.filter((id) => id !== trainerId)
        : [...current, trainerId],
    });
  }

  protected addVenue(): void {
    this.store.addVenue(this.newVenue());
    this.newVenue.set('');
  }

  protected deleteVenue(id: string): void {
    const deleted = this.store.deleteVenue(id);
    this.message.set(
      deleted
        ? 'Der Ort wurde gelöscht.'
        : 'Der Ort wird noch von Terminen oder Standardwerten verwendet und kann nicht gelöscht werden.',
    );
  }
}
