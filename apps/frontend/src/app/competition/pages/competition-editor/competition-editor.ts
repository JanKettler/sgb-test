import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PeopleStore } from '../../../people/people.store';
import { GROUPS, GroupId } from '../../../training/training.models';
import { DateField } from '../../../ui/date-field';
import { Icon, IconName } from '../../../ui/icon';
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
  showTime,
} from '../../competition.models';
import { CompetitionStore, MailDraft } from '../../competition.store';
import { downloadBytes, escapeHtml, printHtml } from '../../competition-download';
import { EntryForm } from '../entry-form/entry-form';
import { MeetChecklist } from '../meet-checklist/meet-checklist';
import { MeetResults } from '../meet-results/meet-results';
import { MeetSchedule } from '../meet-schedule/meet-schedule';
import { MailDialog } from '../mail-dialog/mail-dialog';
import { RelayForm } from '../relay-form/relay-form';

type Tab = 'base' | 'sections' | 'events' | 'entries' | 'check' | 'schedule' | 'results' | 'staff';
type Staff = 'officials' | 'coaches';
type RegMode = 'all' | 'groups' | 'locked';
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
  imports: [
    Icon,
    DateField,
    ModalDialog,
    EntryForm,
    MailDialog,
    RelayForm,
    MeetChecklist,
    MeetSchedule,
    MeetResults,
  ],
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
  protected readonly showTime = showTime;

  private readonly allTabs: readonly { id: Tab; label: string; saved?: true }[] = [
    { id: 'base', label: 'Basisdaten' },
    { id: 'sections', label: 'Abschnitte' },
    { id: 'events', label: 'Wettkampffolge' },
    { id: 'entries', label: 'Meldungen' },
    { id: 'check', label: 'Checkliste', saved: true },
    { id: 'schedule', label: 'Ablauf', saved: true },
    { id: 'results', label: 'Ergebnisse', saved: true },
    { id: 'staff', label: 'Kampfrichter & Trainer' },
  ];
  /** Checklist, schedule and results need a saved meet. */
  protected readonly tabs = this.allTabs.filter(
    (tab) => !tab.saved || !!this.store.competition(this.id),
  );
  protected readonly tab = signal<Tab>('base');
  protected readonly isNew = !this.store.competition(this.id);
  protected readonly draft = signal<Competition>(
    structuredClone(this.store.competition(this.id) ?? this.store.create()),
  );
  protected readonly invalid = signal(false);
  protected readonly regModes: readonly { id: RegMode; label: string; icon: IconName }[] = [
    { id: 'all', label: 'Alle', icon: 'unlock' },
    { id: 'groups', label: 'Nur bestimmte Gruppen', icon: 'users' },
    { id: 'locked', label: 'Gesperrt', icon: 'lock' },
  ];
  /** Who may register: everybody, the chosen groups, or nobody (also before the deadline). */
  protected readonly regMode = signal<RegMode>(this.regModeOf(this.draft()));
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
  protected readonly hasEntries = computed(() => this.starters().length + this.relays().length > 0);
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

  private regModeOf(item: Competition): RegMode {
    if (!item.open) return 'locked';
    return item.groupIds.length > 0 ? 'groups' : 'all';
  }

  protected setRegMode(mode: RegMode): void {
    this.regMode.set(mode);
    if (mode === 'all') this.patch({ open: true, groupIds: [] });
    else this.patch({ open: mode === 'groups' });
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
    if (this.regMode() === 'groups' && item.groupIds.length === 0) {
      this.tab.set('base');
      this.toasts.show('Bitte mindestens eine Gruppe wählen oder „Alle“ einstellen.', 'bad');
      return;
    }
    // Checklist, Meldeergebnis and results are saved on their own tabs; the draft must not undo them.
    const stored = this.store.competition(item.id);
    this.store.save({
      ...item,
      title: item.title.trim(),
      plan: stored?.plan ?? item.plan,
      schedule: stored?.schedule ?? item.schedule,
    });
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

  /** Print list of everything the club has entered. */
  protected printEntryList(): void {
    const item = this.draft();
    const rows = this.store.starters(item).map((row) => {
      const member = this.people.member(row.personId);
      const starts = row.entries
        .map(
          (entry) =>
            `Wk ${entry.eventNo} ${escapeHtml(this.startLabel(entry.eventNo))} ${showTime(entry.time) || 'ohne Zeit'}`,
        )
        .join('<br>');
      return `<tr><td><b>${escapeHtml(row.name)}</b></td><td>${member?.birthDate.slice(0, 4) ?? ''}</td><td>${escapeHtml(member?.dsvId ?? '')}</td><td>${starts}</td></tr>`;
    });
    const relays = this.relays().map((relay) => {
      const names = relay.memberIds.map((id) => escapeHtml(this.store.nameOf(id))).join(', ');
      return `<tr><td><b>${this.relayName(relay)}</b></td><td>${relay.year}</td><td></td><td>Wk ${relay.eventNo} ${escapeHtml(this.startLabel(relay.eventNo))} ${showTime(relay.time) || 'ohne Zeit'}<br>${names}</td></tr>`;
    });
    printHtml(
      `Meldeliste ${item.title}`,
      `<h1>Meldeliste ${escapeHtml(this.store.club.name)}</h1><div class="sub"><b>${escapeHtml(item.title)}</b> · ${escapeHtml(item.place)}</div>` +
        `<table><tr><th>Schwimmer</th><th>Jg.</th><th>DSV-Id</th><th>Starts</th></tr>${[...rows, ...relays].join('')}</table>` +
        `<p>Meldegeld gesamt: <b>${euro(this.total())}</b></p>`,
    );
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

  /** "100m Freistil" for the event number, as set in the event list. */
  protected startLabel(eventNo: number): string {
    const event = this.draft().events.find((item) => item.no === eventNo);
    return event ? eventLabel(event) : '–';
  }

  protected yearOf(personId: string): string {
    return this.people.member(personId)?.birthDate.slice(0, 4) ?? '–';
  }

  // Judges and coaches, per section
  protected staffNames(kind: Staff, section: number): { id: string; name: string }[] {
    return (this.draft()[kind][section] ?? []).map((id) => ({ id, name: this.store.nameOf(id) }));
  }

  protected staffAddable(kind: Staff, section: number): { id: string; name: string }[] {
    const chosen = new Set(this.draft()[kind][section] ?? []);
    return this.store.staffCandidates().filter((person) => !chosen.has(person.id));
  }

  protected addStaff(kind: Staff, section: number, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const id = select.value;
    select.value = '';
    if (id) this.setStaff(kind, section, [...(this.draft()[kind][section] ?? []), id]);
  }

  protected removeStaff(kind: Staff, section: number, id: string): void {
    this.setStaff(
      kind,
      section,
      (this.draft()[kind][section] ?? []).filter((item) => item !== id),
    );
  }

  private setStaff(kind: Staff, section: number, ids: string[]): void {
    this.patch({ [kind]: { ...this.draft()[kind], [section]: ids } });
  }

  /** "2 von 3": judges entered for the section against the number set in the checklist. */
  protected judgePill(section: number): { text: string; ok: boolean } | null {
    const needed = this.store.competition(this.draft().id)?.plan.judges[section];
    if (needed === null || needed === undefined) return null;
    const have = (this.draft().officials[section] ?? []).length;
    return { text: `${have} von ${needed}`, ok: have >= needed };
  }

  protected startAdding(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    (event.target as HTMLSelectElement).value = '';
    if (id) this.editing.set(id);
  }
}
