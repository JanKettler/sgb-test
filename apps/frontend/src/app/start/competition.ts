import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { fullDate, weekdayLong } from '../training/training-dates';
import { Icon } from '../ui/icon';
import { StartStore } from './start.store';

/** Detail page of one swim meet, reached by links from the start page, tasks and notes. */
@Component({
  selector: 'app-competition-page',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="button mb-4" routerLink="/"><app-icon name="chevron-left" /> Zur Startseite</a>
    @if (meet(); as m) {
      <h2 class="title is-4 mb-1"><app-icon name="flag" class="has-text-link" /> {{ m.title }}</h2>
      <p class="subtitle is-6">{{ weekday(m.date) }}, {{ fullDate(m.date) }} · {{ m.place }}</p>
      <section class="box">
        <h3 class="title is-5">Fristen</h3>
        <p>Interner Meldeschluss: {{ fullDate(m.internalDeadline) }}</p>
        <p>Meldeschluss: {{ fullDate(m.deadline) }}</p>
        <p>
          {{
            m.entriesSent
              ? 'Die Meldung ist abgeschickt.'
              : 'Die Meldung ist noch nicht abgeschickt.'
          }}
        </p>
      </section>
      <section class="box">
        <h3 class="title is-5">Wer startet</h3>
        @if (m.starters.length > 0) {
          <div class="chips">
            @for (starter of m.starters; track starter.name) {
              <span class="chip is-solid">{{ starter.name }} · {{ starter.starts }} Starts</span>
            }
          </div>
        } @else {
          <p class="has-text-grey">Noch keine Meldung hochgeladen.</p>
        }
      </section>
    } @else {
      <p class="has-text-grey">Diesen Wettkampf gibt es nicht (mehr).</p>
    }
  `,
  styles: `
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
  `,
})
export class CompetitionPage {
  private readonly data = inject(StartStore);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');

  protected readonly fullDate = fullDate;
  protected readonly weekday = weekdayLong;
  protected readonly meet = computed(() =>
    this.data.competitions().find((competition) => competition.id === this.id),
  );
}
