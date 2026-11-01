import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EvaluationBlock } from './evaluation-block';
import { Block } from './evaluation.model';

/** A page of the evaluation on a white sheet like Excel: titles and tables one below the other. */
@Component({
  selector: 'app-evaluation-blocks',
  imports: [EvaluationBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .panel {
      background: var(--xl-bg);
      border: 1px solid var(--sgb-line);
      border-radius: 8px;
      overflow-x: auto;
      padding: 14px;
    }

    .side-by-side {
      align-items: flex-start;
      display: flex;
      flex-wrap: wrap;
      gap: 22px;
    }
  `,
  template: `
    <div class="panel">
      @for (block of blocks(); track $index) {
        @if (block.type === 'columns') {
          <div class="side-by-side">
            @for (column of block.columns; track $index) {
              <div>
                @for (inner of column; track $index) {
                  <app-evaluation-block [block]="inner" />
                }
              </div>
            }
          </div>
        } @else if (block.type === 'sheet') {
          @for (inner of block.blocks; track $index) {
            <app-evaluation-block [block]="inner" />
          }
        } @else {
          <app-evaluation-block [block]="block" />
        }
      }
    </div>
  `,
})
export class EvaluationBlocks {
  readonly blocks = input.required<Block[]>();
}
