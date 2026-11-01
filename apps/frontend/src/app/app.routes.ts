import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Startseite – SGB Portal',
    loadComponent: () => import('./start/start').then((module) => module.Start),
  },
  {
    path: 'training/anmeldung',
    title: 'Trainingsanmeldung – SGB Portal',
    loadComponent: () =>
      import('./training/pages/registration/registration').then(
        (module) => module.TrainingRegistration,
      ),
  },
  {
    path: 'training/termine',
    title: 'Trainingstermine – SGB Portal',
    loadComponent: () =>
      import('./training/pages/sessions/sessions').then((module) => module.Sessions),
  },
  {
    path: 'training/termine/neu',
    title: 'Neuer Termin – SGB Portal',
    loadComponent: () =>
      import('./training/pages/session-editor/session-editor').then(
        (module) => module.SessionEditor,
      ),
  },
  {
    path: 'training/termine/:id',
    title: 'Termin bearbeiten – SGB Portal',
    loadComponent: () =>
      import('./training/pages/session-editor/session-editor').then(
        (module) => module.SessionEditor,
      ),
  },
  {
    path: 'training/anwesenheit',
    title: 'Anwesenheit – SGB Portal',
    loadComponent: () =>
      import('./training/pages/attendance-overview/attendance-overview').then(
        (module) => module.AttendanceOverview,
      ),
  },
  {
    path: 'training/anwesenheit/:id',
    title: 'Anwesenheit – SGB Portal',
    loadComponent: () =>
      import('./training/pages/attendance-session/attendance-session').then(
        (module) => module.AttendanceSession,
      ),
  },
  {
    path: 'training/einstellungen',
    title: 'Trainingseinstellungen – SGB Portal',
    loadComponent: () =>
      import('./training/pages/settings/settings').then((module) => module.TrainingSettings),
  },
  {
    path: 'personen',
    title: 'Personen – SGB Portal',
    loadComponent: () => import('./people/pages/people-list').then((module) => module.PeopleList),
  },
  {
    path: 'personen/neu',
    title: 'Neue Person – SGB Portal',
    loadComponent: () =>
      import('./people/pages/person-editor').then((module) => module.PersonEditor),
  },
  {
    path: 'personen/eltern/neu',
    title: 'Neue Eltern – SGB Portal',
    loadComponent: () =>
      import('./people/pages/parent-editor').then((module) => module.ParentEditor),
  },
  {
    path: 'personen/eltern/:id',
    title: 'Eltern bearbeiten – SGB Portal',
    loadComponent: () =>
      import('./people/pages/parent-editor').then((module) => module.ParentEditor),
  },
  {
    path: 'personen/:id',
    title: 'Person bearbeiten – SGB Portal',
    loadComponent: () =>
      import('./people/pages/person-editor').then((module) => module.PersonEditor),
  },
  {
    path: 'brett',
    title: 'Schwarzes Brett – SGB Portal',
    loadComponent: () => import('./board/pages/board-page').then((module) => module.BoardPage),
  },
  {
    path: 'aufgaben',
    title: 'Aufgaben – SGB Portal',
    loadComponent: () => import('./tasks/tasks').then((module) => module.Tasks),
  },
  {
    path: 'bald/:seite',
    title: 'In Planung – SGB Portal',
    loadComponent: () => import('./core/soon-page').then((module) => module.SoonPage),
  },
  {
    path: 'wettkaempfe/:id',
    pathMatch: 'full',
    redirectTo: 'wettkampf/wettkaempfe/:id',
  },
  {
    path: 'wettkampf/wettkaempfe',
    title: 'Wettkämpfe – SGB Portal',
    loadComponent: () =>
      import('./competition/pages/competition-list/competition-list').then(
        (module) => module.CompetitionList,
      ),
  },
  {
    path: 'wettkampf/wettkaempfe/neu',
    title: 'Neuer Wettkampf – SGB Portal',
    loadComponent: () =>
      import('./competition/pages/competition-editor/competition-editor').then(
        (module) => module.CompetitionEditor,
      ),
  },
  {
    path: 'wettkampf/wettkaempfe/:id',
    title: 'Wettkampf – SGB Portal',
    loadComponent: () =>
      import('./competition/pages/competition-editor/competition-editor').then(
        (module) => module.CompetitionEditor,
      ),
  },
  {
    path: 'wettkampf/anmeldung',
    title: 'Wettkampf-Anmeldung – SGB Portal',
    loadComponent: () =>
      import('./competition/pages/entry/entry').then((module) => module.CompetitionEntry),
  },
  {
    path: 'wettkampf/auswertung',
    title: 'Auswertung – SGB Portal',
    loadComponent: () =>
      import('./competition/pages/evaluation/evaluation').then(
        (module) => module.CompetitionEvaluation,
      ),
  },
  {
    path: 'beitraege',
    title: 'Beiträge – SGB Portal',
    loadComponent: () => import('./fees/pages/fees').then((module) => module.Fees),
  },
  {
    path: 'warteliste/status',
    title: 'Status der Anmeldung – SGB Portal',
    loadComponent: () => import('./waitlist/status').then((module) => module.Status),
  },
  {
    path: 'intern/warteliste',
    title: 'Interne Warteliste – SGB Portal',
    loadComponent: () =>
      import('./waitlist/administration').then((module) => module.Administration),
  },
  {
    path: 'warteliste/anmelden',
    title: 'Warteliste – SGB Portal',
    loadComponent: () => import('./waitlist/registration').then((module) => module.Registration),
  },
];
