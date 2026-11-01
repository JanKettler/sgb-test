import { Routes } from '@angular/router';

export const YOUTH_ROUTES: Routes = [
  {
    path: '',
    title: 'Jugend – SGB Portal',
    data: { seite: 'jugend' },
    loadComponent: () => import('../core/soon-page').then((module) => module.SoonPage),
  },
];
