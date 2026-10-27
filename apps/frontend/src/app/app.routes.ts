import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Startseite – SGB Portal',
    loadComponent: () => import('./training/pages/home/home').then((module) => module.Home),
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
    path: 'personen/:id',
    title: 'Person bearbeiten – SGB Portal',
    loadComponent: () =>
      import('./people/pages/person-editor').then((module) => module.PersonEditor),
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
