import { Injectable, computed, inject, signal } from '@angular/core';
import { TrainingStore } from '../training/training.store';
import { ClubDocument, DOCUMENT_CATEGORIES } from './documents.models';

function compare(a: ClubDocument, b: ClubDocument): number {
  const byCategory =
    DOCUMENT_CATEGORIES.indexOf(a.category) - DOCUMENT_CATEGORIES.indexOf(b.category);
  return byCategory || a.title.localeCompare(b.title, 'de');
}

/** In-memory stand-in for the future document API. All data is invented. */
@Injectable({ providedIn: 'root' })
export class DocumentsStore {
  private readonly training = inject(TrainingStore);
  private counter = 100;

  /** Everybody who manages the club may read; only the board changes the list. */
  readonly canEdit = this.training.isAdmin;
  readonly documents = signal<ClubDocument[]>(this.sample());
  readonly sorted = computed(() => [...this.documents()].sort(compare));

  save(document: ClubDocument): void {
    if (!document.id) {
      this.documents.update((list) => [...list, { ...document, id: `d-${++this.counter}` }]);
      return;
    }
    this.documents.update((list) =>
      list.map((item) => (item.id === document.id ? document : item)),
    );
  }

  remove(id: string): void {
    this.documents.update((list) => list.filter((item) => item.id !== id));
  }

  private sample(): ClubDocument[] {
    const doc = (
      id: string,
      category: ClubDocument['category'],
      title: string,
      note = '',
      file = '',
    ): ClubDocument => ({
      id,
      category,
      title,
      note,
      url: file ? `https://example.org/dokumente/${file}` : '',
    });
    return [
      doc(
        'd-1',
        'Verein',
        'Satzung',
        'Gültige Fassung seit der letzten Jahreshauptversammlung',
        'satzung.pdf',
      ),
      doc('d-2', 'Verein', 'Beitragsordnung', 'Beiträge und Fälligkeiten', 'beitragsordnung.pdf'),
      doc('d-3', 'Verein', 'Datenschutzhinweise', 'Für Mitglieder und Eltern', 'datenschutz.pdf'),
      doc(
        'd-4',
        'Mitgliedschaft',
        'Aufnahmeantrag',
        'Zum Ausdrucken und Unterschreiben',
        'aufnahme.pdf',
      ),
      doc(
        'd-5',
        'Mitgliedschaft',
        'Kündigung der Mitgliedschaft',
        'Schriftlich zum Quartalsende',
        'kuendigung.pdf',
      ),
      doc('d-6', 'Wettkampf', 'Ausschreibung Vereinsmeisterschaft', '', 'vereinsmeisterschaft.pdf'),
      doc(
        'd-7',
        'Training',
        'Trainingsplan Winter',
        'Hallenzeiten und Gruppen',
        'trainingsplan-winter.pdf',
      ),
      doc(
        'd-8',
        'Finanzen',
        'Erstattung von Auslagen',
        'Formular für Belege und Fahrtkosten',
        'auslagen.pdf',
      ),
      doc(
        'd-9',
        'Veranstaltungen',
        'Vorlage Helferliste',
        'Für Feiern und Schwimmfeste',
        'helferliste.pdf',
      ),
      doc('d-10', 'Sonstiges', 'Hallenordnung', 'Noch ohne Link'),
    ];
  }
}
