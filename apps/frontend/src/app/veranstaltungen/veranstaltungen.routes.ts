import { Routes } from '@angular/router';

export const VERANSTALTUNGEN_ROUTES: Routes = [
  {
    path: '',
    title: 'Veranstaltungen – SGB Portal',
    data: { seite: 'veranstaltungen' },
    loadComponent: () => import('../core/soon-page').then((module) => module.SoonPage),
  },
];
