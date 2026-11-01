import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Icon } from '../ui/icon';
import { SOON_PAGES } from './navigation';

/** Placeholder for a page of the old Intranet that is not built in the portal yet. */
@Component({
  selector: 'app-soon-page',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="title is-4 mb-1">{{ page().title }}</h2>
    <p class="subtitle is-6">Diese Seite wird noch gebaut</p>
    <section class="box">
      <p class="mb-3">{{ page().text }}</p>
      <p class="has-text-grey mb-4">
        Im alten Intranet gibt es diesen Bereich bereits. Hier folgt er in einem der nächsten
        Schritte.
      </p>
      <a class="button" routerLink="/"><app-icon name="chevron-left" /> Zur Startseite</a>
    </section>
  `,
})
export class SoonPage {
  private readonly key = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => String(data['seite'] ?? ''))),
    { initialValue: '' },
  );
  protected readonly page = computed(
    () => SOON_PAGES[this.key()] ?? { title: 'Seite', text: 'Diese Seite gibt es noch nicht.' },
  );
}
