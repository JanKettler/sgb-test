import { Routes } from '@angular/router';

export const VORSTAND_ROUTES: Routes = [
  {
    path: '',
    title: 'Vorstand – SGB Portal',
    data: { seite: 'vorstand' },
    loadComponent: () => import('../core/soon-page').then((module) => module.SoonPage),
  },
];
