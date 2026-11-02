import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { fullDate } from '../../training/training-dates';
import { Deadline, ExecutiveBoardStore } from '../executive-board.store';

/** What is due next: open decisions and planned meetings, the nearest date first. */
@Component({
  selector: 'app-board-deadlines',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './deadlines-tab.html',
})
export class DeadlinesTab {
  protected readonly store = inject(ExecutiveBoardStore);
  protected readonly fullDate = fullDate;

  protected whenText(entry: Deadline): string {
    if (entry.days < 0) return `${-entry.days} Tg. überfällig`;
    if (entry.days === 0) return 'heute';
    return `in ${entry.days} Tg.`;
  }
}
