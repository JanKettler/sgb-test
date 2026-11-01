import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { euro } from '../../core/money';
import { Action } from '../../ui/action';
import { STATEMENT_LABEL, Statement, hoursText, sumsOf } from '../billing.models';
import { BillingStore } from '../billing.store';

/** The statements as a list: title, state, hours and total, with a button to open or view. */
@Component({
  selector: 'app-statement-list',
  imports: [Action],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (statements().length === 0) {
      <p class="empty">{{ empty() }}</p>
    } @else {
      <div class="item-list">
        @for (statement of statements(); track statement.id) {
          @let totals = sumsOf(statement);
          <article class="item" [class.is-ok]="statement.state === 'paid'">
            <div class="item-main">
              <div class="item-title">
                {{ statement.title }}
                <span
                  class="pill"
                  [class.is-ok]="statement.state === 'paid'"
                  [class.is-info]="statement.state === 'submitted'"
                  [class.is-warn]="statement.state === 'draft'"
                  >{{ stateLabel[statement.state] }}</span
                >
              </div>
              <div class="item-sub">
                @if (showOwner()) {
                  {{ statement.owner }} ·
                }
                {{ hoursText(totals.hours) }} Std. · {{ statement.lines.length }} Einheiten
              </div>
            </div>
            <div class="item-actions">
              <b class="keep-lines">{{ euro(totals.total) }}</b>
              @if (store.canEdit(statement)) {
                <app-action
                  kind="edit"
                  [label]="statement.title + ' bearbeiten'"
                  (pressed)="opened.emit(statement.id)"
                />
              } @else {
                <app-action
                  kind="view"
                  [label]="statement.title + ' ansehen'"
                  (pressed)="opened.emit(statement.id)"
                />
              }
            </div>
          </article>
        }
      </div>
    }
  `,
})
export class StatementList {
  protected readonly store = inject(BillingStore);
  readonly statements = input.required<readonly Statement[]>();
  readonly showOwner = input(false);
  readonly empty = input('Nichts in dieser Ansicht.');
  readonly opened = output<string>();

  protected readonly euro = euro;
  protected readonly hoursText = hoursText;
  protected readonly sumsOf = sumsOf;
  protected readonly stateLabel = STATEMENT_LABEL;
}
