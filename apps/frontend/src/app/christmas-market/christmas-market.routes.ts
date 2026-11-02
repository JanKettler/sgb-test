import { Routes } from '@angular/router';

export const CHRISTMAS_MARKET_ROUTES: Routes = [
  {
    path: '',
    title: 'Weihnachtsmarkt – SGB Portal',
    loadComponent: () => import('./christmas-market').then((module) => module.ChristmasMarket),
  },
];
