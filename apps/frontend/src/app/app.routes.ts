import { Routes } from '@angular/router';

export const routes: Routes = [
  ...[
    { path: 'training/anmeldung', heading: 'Trainingsanmeldung' },
    { path: 'training/termine', heading: 'Trainingstermine' },
    { path: 'training/anwesenheit', heading: 'Anwesenheit' },
  ].map(({ path, heading }) => ({
    path,
    title: `${heading} – SGB Portal`,
    data: { heading },
    loadComponent: () => import('./training/training-page').then((module) => module.TrainingPage),
  })),
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
