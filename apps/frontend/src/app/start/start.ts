import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Board } from '../board/board';
import { BoardStore } from '../board/board.store';
import { FeesStore } from '../fees/fees.store';
import { PeopleStore } from '../people/people.store';
import { Home } from '../training/pages/home/home';
import { fullDate, parseIsoDate, weekdayShort } from '../training/training-dates';
import { TrainingStore } from '../training/training.store';
import { Icon, IconName } from '../ui/icon';
import { Notice, Tile, TileCategory, Tone } from './start.models';
import { StartStore } from './start.store';

const CATEGORIES: { name: TileCategory; icon: IconName; color: string }[] = [
  { name: 'Training', icon: 'swim', color: '#06b6d4' },
  { name: 'Verein', icon: 'users', color: '#3b82f6' },
];

const NOTICE_ICON: Record<Tone, IconName> = { bad: 'warning', warn: 'hourglass', info: 'info' };
const PRESSING_DAYS = 3;
const SOON_DAYS = 7;
const NOTICE_LIMIT = 6;
const UPCOMING_LIMIT = 5;

interface Upcoming {
  key: string;
  date: string;
  icon: IconName;
  title: string;
  text: string;
  route: string;
  days: number;
}

/** Start page of the Intranet: notice board, next dates, deadlines, tasks, the week and all modules. */
@Component({
  selector: 'app-start',
  imports: [RouterLink, Icon, Board, Home],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './start.html',
  styleUrl: './start.scss',
})
export class Start {
  private readonly training = inject(TrainingStore);
  private readonly people = inject(PeopleStore);
  private readonly fees = inject(FeesStore);
  private readonly board = inject(BoardStore);
  protected readonly data = inject(StartStore);

  protected readonly fullDate = fullDate;
  protected readonly categories = CATEGORIES;
  protected readonly noticeIcon = NOTICE_ICON;
  protected readonly canManage = this.training.canManage;
  protected readonly canSeeClub = this.data.canSeeClub;
  protected readonly canSeeAllTasks = this.data.canSeeAllTasks;

  protected readonly longDate = parseIsoDate(this.training.today).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  /** The greeting follows the time of day; its icon replaces the waving hand of the old Intranet. */
  protected readonly greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 5) return { text: 'Gute Nacht', icon: 'moon' as const, tone: 'has-text-link' };
    if (hour < 11) return { text: 'Guten Morgen', icon: 'sun' as const, tone: 'has-text-warning' };
    if (hour < 17) return { text: 'Hallo', icon: 'cloud-sun' as const, tone: 'has-text-info' };
    return { text: 'Guten Abend', icon: 'moon' as const, tone: 'has-text-link' };
  })();

  protected readonly taskMode = signal<'mine' | 'all'>('mine');

  protected readonly upcoming = computed<Upcoming[]>(() => {
    const list: Upcoming[] = [];
    for (const competition of this.data.upcomingCompetitions()) {
      list.push({
        key: competition.id,
        date: competition.date,
        icon: 'flag',
        title: competition.title,
        text: `${weekdayShort(competition.date)}, ${fullDate(competition.date)} · ${competition.place}`,
        route: '/training/anmeldung',
        days: this.data.daysTo(competition.date),
      });
    }
    for (const event of this.data.events()) {
      const days = this.data.daysTo(event.date);
      if (days < 0) continue;
      list.push({
        key: event.id,
        date: event.date,
        icon: event.icon,
        title: event.title,
        text: `${weekdayShort(event.date)}, ${fullDate(event.date)} · ${event.info}`,
        route: '/',
        days,
      });
    }
    return list.sort((a, b) => a.date.localeCompare(b.date)).slice(0, UPCOMING_LIMIT);
  });

  protected readonly notices = computed<Notice[]>(() => {
    const list: Notice[] = [];
    for (const competition of this.data.upcomingCompetitions()) {
      if (competition.entriesSent) continue;
      const deadlines = [
        { label: 'Interner Meldeschluss', date: competition.internalDeadline },
        { label: 'Meldeschluss', date: competition.deadline },
      ];
      for (const deadline of deadlines) {
        const days = this.data.daysTo(deadline.date);
        if (days < 0 || days > 30) continue;
        list.push({
          title: `${deadline.label} ${competition.title}`,
          text: `${days === 0 ? 'heute' : `in ${days} Tagen`} · ${fullDate(deadline.date).slice(0, 5)}`,
          tone: days <= PRESSING_DAYS ? 'bad' : 'warn',
          route: '/',
          days,
        });
      }
    }
    if (this.canManage()) {
      for (const row of this.people.dueEvidence().slice(0, 4)) {
        list.push({
          title: `${row.label}: ${row.member.firstName} ${row.member.lastName}`,
          text: row.text,
          tone: row.tone === 'bad' ? 'bad' : row.tone === 'warn' ? 'warn' : 'info',
          route: `/personen/${row.member.id}`,
          days: row.days ?? 40,
        });
      }
      const open = this.fees.open().length;
      if (open > 0) {
        list.push({
          title: `${open} offene Beiträge`,
          text: 'Zahlungen prüfen und mahnen',
          tone: 'warn',
          route: '/beitraege',
          days: 25,
        });
      }
    }
    return list.sort((a, b) => a.days - b.days).slice(0, NOTICE_LIMIT);
  });

  protected readonly nextStarters = computed(() => this.data.upcomingCompetitions()[0] ?? null);
  protected readonly startCount = computed(() => {
    const meet = this.nextStarters();
    return meet ? meet.starters.reduce((sum, starter) => sum + starter.starts, 0) : 0;
  });

  protected readonly tasks = computed(() => {
    const all = this.canSeeAllTasks() && this.taskMode() === 'all';
    const list = all ? this.data.tasks() : this.data.myTasks();
    return [...list].sort(
      (a, b) => Number(b.high) - Number(a.high) || (a.due || '9999').localeCompare(b.due || '9999'),
    );
  });

  protected readonly tiles = computed<Tile[]>(() => {
    const open = this.fees.open().length;
    const due = this.people.dueEvidence().length;
    const posts = this.board.live();
    const fresh = posts.filter((post) => this.board.isNew(post)).length;
    const tiles: Tile[] = [
      {
        category: 'Training',
        label: 'Anmeldung',
        hint: 'Zu- und Absagen zum Training',
        route: '/training/anmeldung',
        icon: 'check',
        status: { text: `${this.training.weekEntries().length} Termine in 7 Tagen`, tone: 'ok' },
      },
    ];
    if (this.canManage()) {
      tiles.push(
        {
          category: 'Training',
          label: 'Termine',
          hint: 'Einheiten anlegen, kopieren, Serien',
          route: '/training/termine',
          icon: 'calendar',
        },
        {
          category: 'Training',
          label: 'Anwesenheit',
          hint: 'Listen führen und auswerten',
          route: '/training/anwesenheit',
          icon: 'clipboard',
        },
      );
    }
    tiles.push({
      category: 'Verein',
      label: 'Schwarzes Brett',
      hint: 'Mitteilungen für den ganzen Verein',
      route: '/brett',
      icon: 'pin',
      status: fresh
        ? { text: `${fresh} neu`, tone: 'info' }
        : { text: `${posts.length} Mitteilungen`, tone: 'ok' },
    });
    if (this.canManage()) {
      tiles.push(
        {
          category: 'Verein',
          label: 'Personen',
          hint: 'Mitglieder, Eltern, Nachweise',
          route: '/personen',
          icon: 'users',
          status: due
            ? { text: `${due} Nachweise prüfen`, tone: 'warn' }
            : { text: 'Alles in Ordnung', tone: 'ok' },
        },
        {
          category: 'Verein',
          label: 'Beiträge',
          hint: 'Zahlungen, Mahnungen, Beitragsarten',
          route: '/beitraege',
          icon: 'coins',
          status: open
            ? { text: `${open} offen`, tone: 'warn' }
            : { text: 'Alles bezahlt', tone: 'ok' },
        },
      );
    }
    tiles.push({
      category: 'Verein',
      label: 'Warteliste',
      hint: 'Für einen Platz anmelden',
      route: '/warteliste/anmelden',
      icon: 'list',
    });
    return tiles;
  });

  protected dayNumber(iso: string): string {
    return iso.slice(8, 10);
  }

  protected monthShort(iso: string): string {
    return parseIsoDate(iso).toLocaleDateString('de-DE', { month: 'short' }).replace('.', '');
  }

  protected countdown(days: number): string {
    return days === 0 ? 'heute' : days === 1 ? 'morgen' : `in ${days} Tagen`;
  }

  protected tilesOf(category: TileCategory): Tile[] {
    return this.tiles().filter((tile) => tile.category === category);
  }

  protected dueTone(due: string): string {
    const days = this.data.daysTo(due);
    return days <= 0 ? 'is-danger' : days <= SOON_DAYS ? 'is-warning' : 'is-info';
  }

  protected dueText(due: string): string {
    const days = this.data.daysTo(due);
    return days < 0 ? 'überfällig' : days === 0 ? 'heute' : `bis ${fullDate(due).slice(0, 6)}`;
  }
}
