import { Routes } from '@angular/router';

export const WEIHNACHTSMARKT_ROUTES: Routes = [
  {
    path: '',
    title: 'Weihnachtsmarkt – SGB Portal',
    data: { seite: 'weihnachtsmarkt' },
    loadComponent: () => import('../core/soon-page').then((module) => module.SoonPage),
  },
];
