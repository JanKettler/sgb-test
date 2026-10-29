import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Board } from '../board';

@Component({
  selector: 'app-board-page',
  imports: [Board],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="title is-4">Schwarzes Brett</h2>
    <p class="subtitle is-6">Mitteilungen für den ganzen Verein</p>
    <app-board />
  `,
})
export class BoardPage {}
