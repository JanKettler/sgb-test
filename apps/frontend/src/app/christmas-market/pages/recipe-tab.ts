import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Action } from '../../ui/action';
import { FieldDef, FormDialog, FormValues, listOf, textOf } from '../../ui/form-dialog';
import { ModalDialog } from '../../ui/modal-dialog';
import { Toasts } from '../../ui/toast';
import { numberText, quantity, scaleRecipe } from '../market.models';
import { MarketStore } from '../market.store';

const RECIPE_FORM: readonly FieldDef[] = [
  { key: 'steps', label: 'Zubereitung', type: 'lines', rows: 8, hint: 'Ein Schritt pro Zeile.' },
  { key: 'note', label: 'Hinweis', type: 'textarea', rows: 3 },
];

/** The recipe of the children's punch, scaled to the litres that are needed. */
@Component({
  selector: 'app-market-recipe',
  imports: [Action, FormDialog, ModalDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recipe-tab.html',
})
export class RecipeTab {
  protected readonly store = inject(MarketStore);
  private readonly toasts = inject(Toasts);

  protected readonly quantity = quantity;
  protected readonly numberText = numberText;
  protected readonly recipeForm = RECIPE_FORM;

  /** What was typed in the field; empty means the base volume of the recipe. */
  private readonly typed = signal('');
  protected readonly confirming = signal(false);
  protected readonly editing = signal(false);

  protected readonly liters = computed(() => {
    const text = this.typed().trim();
    if (text === '') return this.store.recipe().baseLiters;
    const value = Number(text.replace(',', '.'));
    return Number.isFinite(value) && value > 0 ? value : 0;
  });
  protected readonly shown = computed(() => this.typed() || String(this.store.recipe().baseLiters));
  protected readonly portions = computed(() => scaleRecipe(this.store.recipe(), this.liters()));
  protected readonly plan = computed(() => this.store.transferPlan(this.liters()));
  protected readonly steps = computed(() =>
    this.store
      .recipe()
      .steps.split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== ''),
  );
  protected readonly values = computed(() => ({
    steps: this.store.recipe().steps,
    note: this.store.recipe().note,
  }));

  protected type(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
  }

  protected save(values: FormValues): void {
    this.store.saveRecipe({
      steps: listOf(values, 'steps').join('\n'),
      note: textOf(values, 'note'),
    });
    this.toasts.saved();
    this.editing.set(false);
  }

  protected transfer(): void {
    const count = this.store.applyRecipe(this.liters());
    this.toasts.saved(`${count} Zutaten in der Einkaufsliste angepasst`);
    this.confirming.set(false);
  }
}
