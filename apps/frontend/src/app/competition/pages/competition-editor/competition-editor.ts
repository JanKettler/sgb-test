import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PeopleStore } from '../../../people/people.store';
import { GROUPS, GroupId } from '../../../training/training.models';
import { DateField } from '../../../ui/date-field';
import { Icon } from '../../../ui/icon';
import { ModalDialog } from '../../../ui/modal-dialog';
import { Toasts } from '../../../ui/toast';
import { fullDate } from '../../../training/training-dates';
import {
  BankData,
  CompEvent,
  CompSection,
  Competition,
  RelayEntry,
  STROKES,
  STYLES,
  TIMINGS,
  eventLabel,
  euro,
} from '../../competition.models';
import { CompetitionStore, MailDraft } from '../../competition.store';
import { downloadBytes } from '../../competition-download';
import { EntryForm } from '../entry-form/entry-form';
import { MailDialog } from '../mail-dialog/mail-dialog';
import { RelayForm } from '../relay-form/relay-form';

type Tab = 'base' | 'sections' | 'events' | 'entries' | 'staff';
type Staff = 'officials' | 'coaches';
type TextKey =
  | 'title'
  | 'place'
  | 'organiser'
  | 'host'
  | 'venueName'
  | 'venueStreet'
  | 'venueZip'
  | 'venueCity'
  | 'contactName'
  | 'contactEmail'
  | 'contactPhone'
  | 'note'
  | 'deadlineTime';
type MoneyKey = 'flatFee' | 'perSwimmerFee' | 'discount';

@Component({
  selector: 'app-competition-editor',
  imports: [Icon, DateField, ModalDialog, EntryForm, MailDialog, RelayForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './competition-editor.html',
  styleUrl: './competition-editor.scss',
})
export class CompetitionEditor {
  protected readonly store = inject(CompetitionStore);
  private readonly people = inject(PeopleStore);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');

  protected readonly groups = GROUPS;
  protected readonly strokes = STROKES;
  protected readonly styles = STYLES;
  protected readonly timings = TIMINGS;
  protected readonly euro = euro;
  protected readonly eventLabel = eventLabel;
  protected readonly fullDate = fullDate;

  protected readonly tabs: readonly { id: Tab; label: string }[] = [
    { id: 'base', label: 'Basisdaten' },
    { id: 'sections', label: 'Abschnitte' },
    { id: 'events', label: 'Wettkampffolge' },
    { id: 'entries', label: 'Meldungen' },
    { id: 'staff', label: 'Kampfrichter & Trainer' },
  ];
  protected readonly tab = signal<Tab>('base');
  protected readonly isNew = !this.store.competition(this.id);
  protected readonly draft = signal<Competition>(
    structuredClone(this.store.competition(this.id) ?? this.store.create()),
  );
  protected readonly invalid = signal(false);
  protected readonly editing = signal('');
  protected readonly adding = signal('');
  protected readonly mail = signal<'entry' | 'treasurer' | null>(null);
  protected readonly exporting = signal(false);
  protected readonly exportKind = signal<'zip' | 'dsv7' | 'control'>('zip');
  protected readonly relayEditing = signal<RelayEntry | 'new' | null>(null);
  protected readonly relayDelete = signal<RelayEntry | null>(null);
  protected readonly personDelete = signal('');
  protected readonly exportKinds = [
    { id: 'zip', label: 'Meldedatei und Kontrollausdruck (ZIP)' },
    { id: 'dsv7', label: 'Nur die Meldedatei (DSV7)' },
    { id: 'control', label: 'Nur der Kontrollausdruck (Text)' },
  ] as const;
  protected readonly staffKinds: readonly { id: Staff; label: string }[] = [
    { id: 'officials', label: 'Kampfrichter' },
    { id: 'coaches', label: 'Trainer' },
  ];
  protected readonly canRelays = computed(() => this.store.canEditRelays());

  protected readonly starters = computed(() => this.store.starters(this.draft()));
  protected readonly counts = computed(() => this.store.counts(this.draft()));
  protected readonly total = computed(() => this.store.totalFee(this.draft()));
  protected readonly relays = computed(() => {
    this.store.relays();
    return this.store.relaysOf(this.draft().id);
  });
  protected readonly mailDraft = computed<MailDraft | null>(() => {
    const kind = this.mail();
    if (kind === 'entry') return this.store.entryMailDraft(this.draft());
    if (kind === 'treasurer') return this.store.treasurerMailDraft(this.draft());
    return null;
  });

  /** Swimmers who are not in the meet yet, for "Person hinzufügen". */
  protected readonly addable = computed(() => {
    const listed = new Set(this.starters().map((row) => row.personId));
    return this.people
      .members()
      .filter(
        (member) => member.swimmer && member.competes && member.active && !listed.has(member.id),
      )
      .map((member) => ({ id: member.id, name: `${member.firstName} ${member.lastName}` }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  });

  protected patch(change: Partial<Competition>): void {
    this.draft.update((item) => ({ ...item, ...change }));
  }

  protected text(key: TextKey, event: Event): void {
    this.patch({ [key]: (event.target as HTMLInputElement).value });
  }

  protected money(key: MoneyKey, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value.replace(',', '.'));
    this.patch({ [key]: Number.isFinite(value) && value > 0 ? value : 0 });
  }

  protected bank(key: keyof BankData, event: Event): void {
    this.patch({ bank: { ...this.draft().bank, [key]: (event.target as HTMLInputElement).value } });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected toggleGroup(id: GroupId): void {
    const current = this.draft().groupIds;
    this.patch({
      groupIds: current.includes(id) ? current.filter((group) => group !== id) : [...current, id],
    });
  }

  // Sections
  protected addSection(): void {
    const sections = this.draft().sections;
    const last = sections[sections.length - 1];
    this.patch({
      sections: [
        ...sections,
        {
          no: (last?.no ?? 0) + 1,
          date: last?.date ?? this.draft().deadline,
          entry: '',
          warmup: '',
          judges: '',
          start: '',
          relative: false,
        },
      ],
    });
  }

  protected setSection(index: number, change: Partial<CompSection>): void {
    this.patch({
      sections: this.draft().sections.map((item, at) =>
        at === index ? { ...item, ...change } : item,
      ),
    });
  }

  protected removeSection(index: number): void {
    this.patch({ sections: this.draft().sections.filter((_, at) => at !== index) });
  }

  // Events
  protected addEvent(): void {
    const events = this.draft().events;
    const last = events[events.length - 1];
    this.patch({
      events: [
        ...events,
        {
          no: (last?.no ?? 0) + 1,
          section: last?.section ?? 1,
          count: 1,
          distance: last?.distance ?? 50,
          stroke: last?.stroke ?? 'F',
          style: 'GL',
          sex: last?.sex === 'M' ? 'W' : 'M',
          birthYears: 'offen',
          fee: last?.fee ?? 0,
        },
      ],
    });
  }

  protected setEvent(index: number, change: Partial<CompEvent>): void {
    this.patch({
      events: this.draft().events.map((item, at) => (at === index ? { ...item, ...change } : item)),
    });
  }

  protected removeEvent(index: number): void {
    this.patch({ events: this.draft().events.filter((_, at) => at !== index) });
  }

  protected number(event: Event): number {
    const value = Number((event.target as HTMLInputElement).value.replace(',', '.'));
    return Number.isFinite(value) ? value : 0;
  }

  // Saving
  protected save(): void {
    const item = this.draft();
    if (!item.title.trim()) {
      this.invalid.set(true);
      this.tab.set('base');
      this.toasts.show('Bitte einen Namen eintragen.', 'bad');
      return;
    }
    this.store.save({ ...item, title: item.title.trim() });
    this.toasts.saved('Wettkampf gespeichert');
    void this.router.navigate(['/wettkampf/wettkaempfe']);
  }

  protected cancel(): void {
    this.toasts.cancelled();
    void this.router.navigate(['/wettkampf/wettkaempfe']);
  }

  // Entries
  protected download(): void {
    const { name, bytes, type } = this.store.entryDownload(this.draft(), this.exportKind());
    downloadBytes(name, bytes, type);
    this.exporting.set(false);
    this.toasts.show('Datei erstellt', 'info');
  }

  protected sendMail(draft: MailDraft): void {
    const kind = this.mail();
    this.store.sendMail(this.draft().id, draft);
    this.mail.set(null);
    this.toasts.show('E-Mail im Postausgang vermerkt', 'info');
    if (kind === 'entry') this.setSent(true);
  }

  protected markSent(): void {
    const stored = this.store.competition(this.draft().id);
    if (stored) this.setSent(!stored.sent);
  }

  private setSent(sent: boolean): void {
    const stored = this.store.competition(this.draft().id);
    if (!stored) return;
    this.store.save({ ...stored, sent });
    this.patch({ sent });
    this.toasts.show(
      sent ? 'Als gesendet markiert' : 'Wieder auf „nicht gesendet“ gestellt',
      'info',
    );
  }

  protected removePerson(): void {
    const id = this.personDelete();
    this.store.setEntries(this.draft().id, id, []);
    this.personDelete.set('');
    this.toasts.show('Meldungen der Person gelöscht', 'info');
  }

  protected removeRelay(): void {
    const relay = this.relayDelete();
    if (relay) this.store.removeRelay(relay);
    this.relayDelete.set(null);
    this.toasts.show('Staffel gelöscht', 'info');
  }

  protected relayName(relay: RelayEntry): string {
    return `${relay.team}. Mannschaft`;
  }

  protected relayEvent(relay: RelayEntry): string {
    const event = this.draft().events.find((item) => item.no === relay.eventNo);
    return event ? `Wk ${event.no} · ${eventLabel(event)}` : `Wk ${relay.eventNo}`;
  }

  // Judges and coaches
  protected staffNames(kind: Staff): { id: string; name: string }[] {
    return this.draft()[kind].map((id) => ({ id, name: this.store.nameOf(id) }));
  }

  protected staffAddable(kind: Staff): { id: string; name: string }[] {
    const chosen = new Set(this.draft()[kind]);
    return this.store.staffCandidates().filter((person) => !chosen.has(person.id));
  }

  protected addStaff(kind: Staff, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const id = select.value;
    select.value = '';
    if (id) this.patch({ [kind]: [...this.draft()[kind], id] });
  }

  protected removeStaff(kind: Staff, id: string): void {
    this.patch({ [kind]: this.draft()[kind].filter((item) => item !== id) });
  }

  protected startAdding(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    (event.target as HTMLSelectElement).value = '';
    if (id) this.editing.set(id);
  }
}
