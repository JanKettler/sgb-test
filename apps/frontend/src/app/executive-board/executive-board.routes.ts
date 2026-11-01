import { Routes } from '@angular/router';

export const EXECUTIVE_BOARD_ROUTES: Routes = [
  {
    path: '',
    title: 'Vorstand – SGB Portal',
    loadComponent: () => import('./executive-board').then((module) => module.ExecutiveBoard),
  },
];
