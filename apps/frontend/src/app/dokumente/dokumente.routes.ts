import { Routes } from '@angular/router';

export const DOKUMENTE_ROUTES: Routes = [
  {
    path: '',
    title: 'Dokumente – SGB Portal',
    data: { seite: 'dokumente' },
    loadComponent: () => import('../core/soon-page').then((module) => module.SoonPage),
  },
];
