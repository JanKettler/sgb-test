import { Routes } from '@angular/router';

export const DOCUMENTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Dokumente – SGB Portal',
    loadComponent: () => import('./documents').then((module) => module.Documents),
  },
];
