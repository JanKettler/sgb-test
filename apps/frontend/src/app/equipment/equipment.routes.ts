import { Routes } from '@angular/router';

export const EQUIPMENT_ROUTES: Routes = [
  {
    path: '',
    title: 'Material – SGB Portal',
    loadComponent: () => import('./equipment').then((module) => module.Equipment),
  },
];
