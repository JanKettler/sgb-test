import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Startseite – SGB Portal',
    loadComponent: () => import('./training/home').then((module) => module.Home),
  },
  {
    path: 'training/anmeldung',
    title: 'Trainingsanmeldung – SGB Portal',
    loadComponent: () =>
      import('./training/registration').then((module) => module.TrainingRegistration),
  },
  {
    path: 'training/termine',
    title: 'Trainingstermine – SGB Portal',
    loadComponent: () => import('./training/sessions').then((module) => module.Sessions),
  },
  {
    path: 'training/anwesenheit',
    title: 'Anwesenheit – SGB Portal',
    loadComponent: () =>
      import('./training/attendance-overview').then((module) => module.AttendanceOverview),
  },
  {
    path: 'training/anwesenheit/:id',
    title: 'Anwesenheit – SGB Portal',
    loadComponent: () =>
      import('./training/attendance-session').then((module) => module.AttendanceSession),
  },
  {
    path: 'training/einstellungen',
    title: 'Trainingseinstellungen – SGB Portal',
    loadComponent: () =>
      import('./training/training-settings').then((module) => module.TrainingSettings),
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
