import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Board } from '../board/board';
import { FeesStore } from '../fees/fees.store';
import { PeopleStore } from '../people/people.store';
import { Home } from '../training/pages/home/home';
import { parseIsoDate, shortDay } from '../training/training-dates';
import { GROUPS } from '../training/training.models';
import { TrainingStore } from '../training/training.store';
import { Icon, IconName } from '../ui/icon';

interface LinkTile {
  label: string;
  hint: string;
  route: string;
  icon: IconName;
  tone: string;
}

/** Start page: notice board, next dates, deadlines and shortcuts into the modules. */
@Component({
  selector: 'app-start',
  imports: [RouterLink, Icon, Board, Home],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './start.html',
})
export class Start {
  private readonly training = inject(TrainingStore);
  private readonly people = inject(PeopleStore);
  private readonly fees = inject(FeesStore);

  protected readonly canManage = this.training.canManage;

  protected readonly longDate = parseIsoDate(this.training.today).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  protected readonly stats = computed(() => [
    { icon: 'users' as const, label: 'Mitglieder', value: this.people.activeMembers().length },
    { icon: 'list' as const, label: 'Gruppen', value: GROUPS.length },
    {
      icon: 'clipboard' as const,
      label: 'Trainer',
      value: this.people.activeMembers().filter((member) => member.trainer).length,
    },
  ]);

  protected readonly nextSessions = computed(() =>
    this.training
      .sessions()
      .filter((session) => session.date >= this.training.today)
      .slice(0, 5)
      .map((session) => ({
        id: session.id,
        day: shortDay(session.date),
        time: session.time,
        title: this.training.groupNames(session),
        place: this.training.venueName(session.venueId),
      })),
  );

  protected readonly deadlines = computed(() => {
    const items = this.people
      .dueEvidence()
      .slice(0, 4)
      .map((row) => ({
        title: `${row.label}: ${row.member.firstName} ${row.member.lastName}`,
        text: row.text,
        tone: row.tone === 'bad' ? 'is-danger' : row.tone === 'warn' ? 'is-warning' : 'is-info',
        route: `/personen/${row.member.id}`,
      }));
    const open = this.fees.open().length;
    if (open > 0) {
      items.push({
        title: `${open} offene Beiträge`,
        text: 'Zahlungen prüfen und mahnen',
        tone: 'is-warning',
        route: '/beitraege',
      });
    }
    return items;
  });

  protected readonly groupCounts = computed(() =>
    GROUPS.map((group) => ({
      name: group.name,
      count: this.people
        .activeMembers()
        .filter((member) => member.swimmerGroupIds.includes(group.id)).length,
    })),
  );

  protected readonly tiles = computed<LinkTile[]>(() => {
    const tiles: LinkTile[] = [
      {
        label: 'Training',
        hint: 'Anmeldung und Termine',
        route: '/training/anmeldung',
        icon: 'calendar',
        tone: 'is-info',
      },
      {
        label: 'Schwarzes Brett',
        hint: 'Alle Mitteilungen',
        route: '/brett',
        icon: 'pin',
        tone: 'is-warning',
      },
      {
        label: 'Warteliste',
        hint: 'Anmelden',
        route: '/warteliste/anmelden',
        icon: 'list',
        tone: 'is-primary',
      },
    ];
    if (this.canManage()) {
      tiles.splice(
        1,
        0,
        {
          label: 'Personen',
          hint: 'Mitglieder, Eltern, Nachweise',
          route: '/personen',
          icon: 'users',
          tone: 'is-danger',
        },
        {
          label: 'Beiträge',
          hint: 'Zahlungen und Mahnungen',
          route: '/beitraege',
          icon: 'coins',
          tone: 'is-success',
        },
      );
    }
    return tiles;
  });
}
