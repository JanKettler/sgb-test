import { Routes } from '@angular/router';

export const EVENTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Veranstaltungen – SGB Portal',
    loadComponent: () => import('./events').then((module) => module.Events),
  },
];
