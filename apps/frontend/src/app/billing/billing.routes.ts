import { Routes } from '@angular/router';

export const BILLING_ROUTES: Routes = [
  {
    path: '',
    title: 'Abrechnung – SGB Portal',
    loadComponent: () => import('./billing').then((module) => module.Billing),
  },
];
