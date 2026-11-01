import { Routes } from '@angular/router';

export const MATERIAL_ROUTES: Routes = [
  {
    path: '',
    title: 'Material – SGB Portal',
    data: { seite: 'material' },
    loadComponent: () => import('../core/soon-page').then((module) => module.SoonPage),
  },
];
