import { Routes } from '@angular/router';

export const YOUTH_ROUTES: Routes = [
  {
    path: '',
    title: 'Jugend – SGB Portal',
    loadComponent: () => import('./youth').then((module) => module.Youth),
  },
];
