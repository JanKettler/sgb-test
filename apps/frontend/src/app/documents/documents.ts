import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Action } from '../ui/action';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { FieldDef, FormDialog, FormValues, textOf } from '../ui/form-dialog';
import { Icon } from '../ui/icon';
import { Toasts } from '../ui/toast';
import { ClubDocument, DOCUMENT_CATEGORIES, categoryOf } from './documents.models';
import { DocumentsStore } from './documents.store';

const FIELDS: readonly FieldDef[] = [
  { key: 'title', label: 'Titel', required: true },
  {
    key: 'category',
    label: 'Bereich',
    type: 'select',
    options: DOCUMENT_CATEGORIES.map((category) => ({ value: category, label: category })),
  },
  {
    key: 'url',
    label: 'Link',
    placeholder: 'https://…',
    hint: 'Adresse der Datei, zum Beispiel von der Homepage oder aus dem Drive.',
  },
  { key: 'note', label: 'Beschreibung', type: 'textarea', rows: 2 },
];

/** Collection of club documents (statutes, forms, templates) as links, grouped by area. */
@Component({
  selector: 'app-documents',
  imports: [Action, Icon, FormDialog, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documents.html',
})
export class Documents {
  protected readonly store = inject(DocumentsStore);
  private readonly toasts = inject(Toasts);
  protected readonly fields = FIELDS;
  protected readonly query = signal('');
  protected readonly category = signal('');
  protected readonly editing = signal<ClubDocument | null>(null);
  protected readonly toDelete = signal<ClubDocument | null>(null);

  protected readonly visible = computed(() => {
    const query = this.query().trim().toLowerCase();
    const category = this.category();
    return this.store
      .sorted()
      .filter((item) => !category || item.category === category)
      .filter(
        (item) =>
          !query || `${item.title} ${item.note} ${item.category}`.toLowerCase().includes(query),
      );
  });

  protected readonly chips = computed(() => {
    const all = this.store.documents();
    const count = (category: string) =>
      category ? all.filter((item) => item.category === category).length : all.length;
    return ['', ...DOCUMENT_CATEGORIES].map((key) => ({
      key,
      label: key || 'Alle',
      count: count(key),
    }));
  });

  /** A link has to be https, so nobody lands on an unsafe address. */
  protected readonly check = (values: FormValues): string => {
    const url = textOf(values, 'url');
    return url && !/^https:\/\//i.test(url) ? 'Der Link muss mit https:// beginnen.' : '';
  };

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected add(): void {
    this.editing.set({
      id: '',
      title: '',
      category: categoryOf(this.category()),
      url: '',
      note: '',
    });
  }

  protected save(values: FormValues): void {
    const current = this.editing();
    if (!current) return;
    this.store.save({
      id: current.id,
      title: textOf(values, 'title'),
      category: categoryOf(textOf(values, 'category')),
      url: textOf(values, 'url'),
      note: textOf(values, 'note'),
    });
    this.toasts.saved(current.id ? 'Dokument gespeichert' : 'Dokument hinzugefügt');
    this.editing.set(null);
  }

  protected confirmDelete(): void {
    const item = this.toDelete();
    if (item) {
      this.store.remove(item.id);
      this.toasts.saved('Dokument gelöscht');
    }
    this.toDelete.set(null);
  }
}
