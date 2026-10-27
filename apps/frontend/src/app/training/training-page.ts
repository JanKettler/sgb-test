import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-training-page',
  template: `
    <section class="section">
      <div class="container">
        <h2 class="title is-3">{{ heading }}</h2>
        <p>Diese Seite wird als Nächstes umgesetzt.</p>
      </div>
    </section>
  `,
})
export class TrainingPage {
  protected readonly heading = inject(ActivatedRoute).snapshot.data['heading'] as string;
}
